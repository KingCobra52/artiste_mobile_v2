from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from backend.app.api.v1.router import router as v1_router
from backend.app.core.config import Settings, get_settings
from backend.app.core.errors import error_payload, install_exception_handlers
from backend.app.core.logging import configure_logging
from backend.app.db.client import close_supabase_client, create_supabase_client
from backend.app.schemas.error import ErrorResponse


def create_app(settings: Settings | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        resolved = settings or get_settings()
        configure_logging(resolved.log_level)
        app.state.settings = resolved
        app.state.supabase = await create_supabase_client(resolved)
        yield
        await close_supabase_client(app.state.supabase)

    application = FastAPI(title="Artiste API", version="1.0.0", lifespan=lifespan)
    install_exception_handlers(application)

    @application.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        supplied_id = request.headers.get("x-request-id", "")
        request.state.request_id = (
            supplied_id
            if supplied_id.isascii()
            and supplied_id.isprintable()
            and 0 < len(supplied_id) <= 128
            else str(uuid4())
        )
        response = await call_next(request)
        response.headers["x-request-id"] = request.state.request_id
        return response

    @application.get("/health", tags=["system"], summary="Check process health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @application.get(
        "/ready",
        tags=["system"],
        responses={503: {"model": ErrorResponse}},
        summary="Check dependency readiness",
    )
    async def ready(request: Request):
        config: Settings = request.app.state.settings
        url = f"{str(config.supabase_url).rstrip('/')}/auth/v1/health"
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(
                    url,
                    headers={"apikey": config.supabase_secret_key},
                )
                response.raise_for_status()
        except httpx.HTTPError:
            return JSONResponse(
                status_code=503,
                content=error_payload(
                    request,
                    code="dependency_unavailable",
                    message="A required service is unavailable.",
                ),
            )
        return {"status": "ready"}

    application.include_router(v1_router)
    return application


app = create_app()

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, *, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)


class DomainNotImplementedError(AppError):
    def __init__(self, message: str = "This capability is not connected yet.") -> None:
        super().__init__(status_code=501, code="domain_not_implemented", message=message)


def error_payload(
    request: Request,
    *,
    code: str,
    message: str,
    field_errors: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "code": code,
        "message": message,
        "request_id": request.state.request_id,
    }
    if field_errors:
        payload["field_errors"] = field_errors
    return payload


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(request, code=exc.code, message=exc.message),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        fields = {
            ".".join(str(part) for part in error["loc"]): error["msg"]
            for error in exc.errors()
        }
        return JSONResponse(
            status_code=422,
            content=error_payload(
                request,
                code="validation_error",
                message="Check the request and try again.",
                field_errors=fields,
            ),
        )

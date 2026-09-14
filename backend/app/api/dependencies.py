from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.app.core.auth import CurrentUser, verify_access_token
from backend.app.core.errors import AppError
from backend.app.services.market import MarketService
from backend.app.services.portfolio import PortfolioService
from backend.app.services.trading import TradingService
from supabase import AsyncClient

bearer_scheme = HTTPBearer(auto_error=False)


def get_supabase(request: Request) -> AsyncClient:
    return request.app.state.supabase


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    client: Annotated[AsyncClient, Depends(get_supabase)],
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppError(
            status_code=401,
            code="unauthenticated",
            message="Provide a valid access token.",
        )
    return await verify_access_token(client, credentials.credentials)


def get_market_service() -> MarketService:
    return MarketService()


def get_portfolio_service() -> PortfolioService:
    return PortfolioService()


def get_trading_service() -> TradingService:
    return TradingService()


SupabaseDep = Annotated[AsyncClient, Depends(get_supabase)]
CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
MarketServiceDep = Annotated[MarketService, Depends(get_market_service)]
PortfolioServiceDep = Annotated[PortfolioService, Depends(get_portfolio_service)]
TradingServiceDep = Annotated[TradingService, Depends(get_trading_service)]

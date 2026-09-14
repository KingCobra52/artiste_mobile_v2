from fastapi import APIRouter

from backend.app.api.dependencies import CurrentUserDep, PortfolioServiceDep
from backend.app.schemas.error import PROTECTED_NOT_IMPLEMENTED_RESPONSES
from backend.app.schemas.portfolio import Portfolio

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get(
    "",
    response_model=Portfolio,
    responses=PROTECTED_NOT_IMPLEMENTED_RESPONSES,
    summary="Get the current user's portfolio",
)
async def get_portfolio(
    user: CurrentUserDep, service: PortfolioServiceDep
) -> Portfolio:
    return await service.get_portfolio(user.id)

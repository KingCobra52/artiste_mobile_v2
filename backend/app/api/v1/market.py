from fastapi import APIRouter

from backend.app.api.dependencies import MarketServiceDep
from backend.app.schemas.error import NOT_IMPLEMENTED_RESPONSE
from backend.app.schemas.market import MarketQuote

router = APIRouter(prefix="/market", tags=["market"])


@router.get(
    "",
    response_model=list[MarketQuote],
    responses=NOT_IMPLEMENTED_RESPONSE,
    summary="List market quotes",
)
async def list_market(service: MarketServiceDep) -> list[MarketQuote]:
    return await service.list_quotes()

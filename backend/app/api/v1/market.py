from fastapi import APIRouter

from backend.app.api.dependencies import MarketServiceDep
from backend.app.schemas.error import MARKET_RESPONSES
from backend.app.schemas.market import MarketQuote

router = APIRouter(prefix="/market", tags=["market"])


@router.get(
    "",
    response_model=list[MarketQuote],
    responses=MARKET_RESPONSES,
    summary="List market quotes",
)
async def list_market(service: MarketServiceDep) -> list[MarketQuote]:
    return await service.list_quotes()


@router.get("/{artist_id}", response_model=MarketQuote)
async def artist_quote(artist_id: int, service: MarketServiceDep):
    return await service.quote_for(str(artist_id))

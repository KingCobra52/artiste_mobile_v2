from fastapi import APIRouter

from backend.app.api.dependencies import CurrentUserDep, TradingServiceDep
from backend.app.schemas.error import PROTECTED_RESPONSES
from backend.app.schemas.trade import TradeDraft, TradePreview, TradeResult

router = APIRouter(prefix="/trades", tags=["trades"])


@router.post(
    "",
    response_model=TradeResult,
    responses=PROTECTED_RESPONSES,
    summary="Submit a trade",
)
async def submit_trade(
    draft: TradeDraft, user: CurrentUserDep, service: TradingServiceDep
) -> TradeResult:
    return await service.submit(user.id, draft)


@router.post("/preview", response_model=TradePreview, responses=PROTECTED_RESPONSES)
async def preview_trade(draft: TradeDraft, user: CurrentUserDep, service: TradingServiceDep):
    return await service.preview(user.id, draft)

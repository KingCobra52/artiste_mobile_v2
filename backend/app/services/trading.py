from uuid import UUID

from backend.app.core.errors import AppError
from backend.app.repositories.portfolios import PortfoliosRepository
from backend.app.schemas.trade import TradeDraft, TradePreview, TradeResult
from backend.app.services.market import MarketService


class TradingService:
    def __init__(
        self, portfolios: PortfoliosRepository | None = None, market: MarketService | None = None
    ):
        self.portfolios, self.market = portfolios, market

    async def preview(self, user_id: UUID, draft: TradeDraft) -> TradePreview:
        if self.portfolios is None:
            raise AppError(
                status_code=503,
                code="trading_unavailable",
                message="Trading is temporarily unavailable.",
            )
        try:
            response = await self.portfolios.client.rpc(
                "trade_estimate",
                {
                    "p_artist_id": int(draft.artist_id),
                    "p_side": draft.side.value,
                    "p_quantity": draft.quantity,
                },
            ).execute()
            return TradePreview.model_validate(response.data)
        except Exception as exc:
            code = next(
                (
                    code
                    for code in (
                        "artist_unsupported",
                        "quote_not_tradable",
                        "invalid_trade",
                        "order_too_small",
                    )
                    if code in str(exc)
                ),
                "trading_unavailable",
            )
            raise AppError(
                status_code=409 if code != "trading_unavailable" else 503,
                code=code,
                message="An estimate is unavailable. Check the artist, quote and quantity.",
            ) from exc

    async def submit(self, user_id: UUID, draft: TradeDraft) -> TradeResult:
        if self.portfolios is None or self.market is None:
            raise AppError(
                status_code=503,
                code="trading_unavailable",
                message="Trading is temporarily unavailable.",
            )
        # The RPC checks retries first, then locks and validates the quote version.
        return await self.portfolios.submit_trade(user_id, draft, int(draft.artist_id))

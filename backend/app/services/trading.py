from uuid import UUID

from backend.app.core.errors import AppError
from backend.app.repositories.portfolios import PortfoliosRepository
from backend.app.schemas.trade import TradeDraft, TradeResult
from backend.app.services.market import MarketService


class TradingService:
    def __init__(
        self,
        portfolios: PortfoliosRepository | None = None,
        market: MarketService | None = None,
    ) -> None:
        self.portfolios = portfolios
        self.market = market

    async def submit(self, user_id: UUID, draft: TradeDraft) -> TradeResult:
        if self.portfolios is None or self.market is None:
            raise AppError(
                status_code=503,
                code="trading_unavailable",
                message="Trading is temporarily unavailable.",
            )
        previous = await self.portfolios.find_trade(user_id, draft)
        if previous is not None:
            result = previous
        else:
            artist = await self.market.get_artist(draft.artist_id)
            quote = await self.market.quote_for(draft.artist_id)
            if quote.status != "fresh" or quote.price_cents is None:
                raise AppError(
                    status_code=409,
                    code="quote_not_tradable",
                    message="This quote is not current, so trading is disabled.",
                )
            result = await self.portfolios.submit_trade(
                user_id,
                draft,
                int(artist.id),
                quote.price_cents,
            )
        artists = await self.market.list_artists()
        quotes = await self.market.list_quotes()
        portfolio = await self.portfolios.get(user_id, artists, quotes)
        await self.portfolios.record_snapshot(
            user_id, portfolio, "trade", trade_id=result.trade_id
        )
        return result

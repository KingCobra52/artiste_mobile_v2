from uuid import UUID

from backend.app.core.errors import AppError
from backend.app.repositories.portfolios import PortfoliosRepository
from backend.app.schemas.portfolio import Portfolio
from backend.app.services.market import MarketService


class PortfolioService:
    def __init__(
        self,
        portfolios: PortfoliosRepository | None = None,
        market: MarketService | None = None,
    ) -> None:
        self.portfolios = portfolios
        self.market = market

    async def get_portfolio(self, user_id: UUID) -> Portfolio:
        if self.portfolios is None or self.market is None:
            raise AppError(
                status_code=503,
                code="portfolio_unavailable",
                message="Your portfolio is temporarily unavailable.",
            )
        return await self.portfolios.get(
            user_id,
            await self.market.list_artists(),
            await self.market.list_quotes(),
        )

    async def record_snapshot(self, user_id: UUID, source: str) -> Portfolio:
        if self.portfolios is None or self.market is None:
            raise AppError(
                status_code=503,
                code="portfolio_unavailable",
                message="Your portfolio is temporarily unavailable.",
            )
        artists = await self.market.list_artists()
        quotes = await self.market.list_quotes()
        portfolio = await self.portfolios.get(user_id, artists, quotes)
        await self.portfolios.record_snapshot(user_id, portfolio, source)
        return portfolio

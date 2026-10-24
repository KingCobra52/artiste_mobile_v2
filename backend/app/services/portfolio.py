from uuid import UUID

from backend.app.core.errors import AppError
from backend.app.repositories.portfolios import PortfoliosRepository
from backend.app.schemas.portfolio import Portfolio


class PortfolioService:
    def __init__(
        self,
        portfolios: PortfoliosRepository | None = None,
    ) -> None:
        self.portfolios = portfolios

    async def get_portfolio(self, user_id: UUID) -> Portfolio:
        if self.portfolios is None:
            raise AppError(
                status_code=503,
                code="portfolio_unavailable",
                message="Your portfolio is temporarily unavailable.",
            )
        return await self.portfolios.get(user_id)

    async def record_snapshot(self, user_id: UUID, source: str) -> Portfolio:
        if self.portfolios is None:
            raise AppError(
                status_code=503,
                code="portfolio_unavailable",
                message="Your portfolio is temporarily unavailable.",
            )
        portfolio = await self.portfolios.get(user_id)
        await self.portfolios.record_snapshot(user_id, portfolio, source)
        return portfolio

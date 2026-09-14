from uuid import UUID

from backend.app.core.errors import DomainNotImplementedError
from backend.app.repositories.portfolios import PortfoliosRepository
from backend.app.schemas.portfolio import Portfolio


class PortfolioService:
    def __init__(self, portfolios: PortfoliosRepository | None = None) -> None:
        self.portfolios = portfolios

    async def get_portfolio(self, user_id: UUID) -> Portfolio:
        raise DomainNotImplementedError()

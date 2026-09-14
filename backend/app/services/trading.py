from uuid import UUID

from backend.app.core.errors import DomainNotImplementedError
from backend.app.repositories.portfolios import PortfoliosRepository
from backend.app.schemas.trade import TradeDraft, TradeResult


class TradingService:
    def __init__(self, portfolios: PortfoliosRepository | None = None) -> None:
        self.portfolios = portfolios

    async def submit(self, user_id: UUID, draft: TradeDraft) -> TradeResult:
        raise DomainNotImplementedError()

from typing import Protocol
from uuid import UUID

from backend.app.schemas.portfolio import Portfolio
from backend.app.schemas.trade import TradeDraft, TradeResult


class PortfoliosRepository(Protocol):
    async def get(self, user_id: UUID) -> Portfolio: ...

    async def submit_trade(self, user_id: UUID, draft: TradeDraft) -> TradeResult: ...

from typing import Protocol

from backend.app.schemas.market import MarketQuote


class SnapshotsRepository(Protocol):
    async def list_quotes(self) -> list[MarketQuote]: ...

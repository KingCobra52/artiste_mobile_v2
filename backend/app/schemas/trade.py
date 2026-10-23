from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from backend.app.schemas.artist import to_camel


class TradeSide(StrEnum):
    BUY = "buy"
    SELL = "sell"


class TradeDraft(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)

    artist_id: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    side: TradeSide
    quantity: int = Field(gt=0)
    request_id: UUID


class TradeResult(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)

    ok: bool
    code: str
    message: str
    trade_id: int
    execution_price_cents: int
    total_cents: int
    cash_cents: int
    idempotent: bool = False

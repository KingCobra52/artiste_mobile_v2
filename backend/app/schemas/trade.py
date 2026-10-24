from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from backend.app.schemas.artist import to_camel


class TradeSide(StrEnum):
    BUY = "buy"
    SELL = "sell"


class TradeDraft(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)

    artist_id: str = Field(pattern=r"^[1-9][0-9]*$")
    side: TradeSide
    quantity: int = Field(gt=0, le=1_000_000)
    request_id: UUID
    quote_version: str | None = None


class TradeResult(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)

    ok: bool
    code: str
    message: str
    trade_id: int
    execution_price_cents: int
    total_cents: int
    cash_cents: int
    fee_cents: int = 0
    idempotent: bool = False


class TradePreview(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    quote_version: str
    gross_cents: int
    fee_cents: int
    total_cents: int
    execution_price_cents: int
    price_after_cents: int
    price_impact_percent: float
    shadow: bool
    as_of: str
    pricing_version: str

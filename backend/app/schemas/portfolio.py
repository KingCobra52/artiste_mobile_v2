from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from backend.app.schemas.artist import Artist, to_camel


class PortfolioStatus(StrEnum):
    FRESH = "fresh"
    STALE = "stale"


class Holding(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)

    artist: Artist
    quantity: int = Field(ge=0)
    average_cost_cents: int = Field(ge=0)
    current_value_cents: int | None = Field(default=None, ge=0)
    first_purchased_at: datetime


class PortfolioSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)

    cash_cents: int = Field(ge=0)
    holdings_value_cents: int | None = Field(default=None, ge=0)
    total_value_cents: int | None = Field(default=None, ge=0)
    gain_loss_cents: int | None = None
    as_of: datetime
    status: PortfolioStatus


class TradeHistoryItem(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)

    id: int
    artist: Artist
    side: str
    quantity: int = Field(gt=0)
    execution_price_cents: int = Field(gt=0)
    total_cents: int = Field(gt=0)
    executed_at: datetime


class Portfolio(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: PortfolioSummary
    holdings: list[Holding]
    trades: list[TradeHistoryItem]

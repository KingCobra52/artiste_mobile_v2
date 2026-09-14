from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from backend.app.schemas.artist import Artist


class PortfolioStatus(StrEnum):
    FRESH = "fresh"
    STALE = "stale"


class Holding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    artist: Artist
    quantity: int = Field(ge=0)
    average_cost_cents: int = Field(ge=0)
    current_value_cents: int | None = Field(default=None, ge=0)
    first_purchased_at: datetime


class PortfolioSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cash_cents: int = Field(ge=0)
    holdings_value_cents: int = Field(ge=0)
    total_value_cents: int = Field(ge=0)
    gain_loss_cents: int
    as_of: datetime
    status: PortfolioStatus


class Portfolio(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: PortfolioSummary
    holdings: list[Holding]

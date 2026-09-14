from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class QuoteStatus(StrEnum):
    FRESH = "fresh"
    STALE = "stale"
    UNAVAILABLE = "unavailable"


class MarketQuote(BaseModel):
    model_config = ConfigDict(extra="forbid")

    artist_id: str
    price_cents: int | None = Field(default=None, ge=0)
    change_percent: float | None = None
    as_of: datetime | None = None
    status: QuoteStatus

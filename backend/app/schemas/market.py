from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from backend.app.schemas.artist import to_camel


class QuoteStatus(StrEnum):
    FRESH = "fresh"
    STALE = "stale"
    UNAVAILABLE = "unavailable"


class MarketQuote(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)

    artist_id: str
    price_cents: int | None = Field(default=None, ge=1)
    change_percent: float | None = None
    as_of: datetime | None = None
    status: QuoteStatus

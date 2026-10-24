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

    quote_version: str | None = None
    pricing_version: str = "audience-inventory-v2"
    external_anchor_cents: int | None = None
    demand_percent: float = 0
    sources: dict = Field(default_factory=dict)
    observation_count: int = 0

    priced_at: datetime | None = None

from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TradeSide(StrEnum):
    BUY = "buy"
    SELL = "sell"


class TradeDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    artist_id: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    side: TradeSide
    quantity: int = Field(gt=0)
    request_id: UUID


class TradeResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool
    code: str
    message: str

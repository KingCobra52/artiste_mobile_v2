from pydantic import BaseModel, ConfigDict


class Artist(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    symbol: str
    genre: str

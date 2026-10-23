from datetime import date
from typing import Protocol

from backend.app.schemas.market import MarketQuote
from backend.app.services.pricing import calculate_quote
from supabase import AsyncClient


class SnapshotsRepository(Protocol):
    async def list_quotes(self) -> list[MarketQuote]: ...


class SupabaseSnapshotsRepository:
    def __init__(self, client: AsyncClient) -> None:
        self.client = client

    async def list_quotes(self) -> list[MarketQuote]:
        response = await self.client.rpc("get_market_snapshots").execute()
        grouped: dict[int, dict[str, list[tuple]]] = {}
        for row in response.data or []:
            record = grouped.setdefault(int(row["artist_id"]), {"lastfm": [], "youtube": []})
            day = row["snapshot_date"]
            if isinstance(day, str):
                day = date.fromisoformat(day)
            record["lastfm"].append((day, row.get("lastfm_playcount")))
            record["youtube"].append((day, row.get("youtube_subscribers")))

        return [
            MarketQuote(
                artist_id=str(artist_id),
                **calculate_quote(record["lastfm"], record["youtube"]),
            )
            for artist_id, record in sorted(grouped.items())
        ]

from typing import Protocol

from backend.app.schemas.artist import Artist
from supabase import AsyncClient


class ArtistsRepository(Protocol):
    async def list(self) -> list[Artist]: ...

    async def get(self, artist_id: str) -> Artist | None: ...


def _symbol(name: str, artist_id: int) -> str:
    parts = [part for part in name.upper().replace(".", "").split() if part]
    symbol = "".join(part[0] for part in parts)[:4]
    return symbol or f"ART{artist_id}"


class SupabaseArtistsRepository:
    def __init__(self, client: AsyncClient) -> None:
        self.client = client

    @staticmethod
    def _artist(row: dict) -> Artist:
        artist_id = int(row["id"])
        return Artist(
            id=str(artist_id),
            name=row["name"],
            symbol=_symbol(row["name"], artist_id),
            genre=row.get("genre") or "Music",
        )

    async def list(self) -> list[Artist]:
        response = (
            await self.client.table("artists").select("id,name,genre").order("name").execute()
        )
        return [self._artist(row) for row in response.data or []]

    async def get(self, artist_id: str) -> Artist | None:
        if not artist_id.isdecimal():
            return None
        response = (
            await self.client.table("artists")
            .select("id,name,genre")
            .eq("id", int(artist_id))
            .maybe_single()
            .execute()
        )
        return self._artist(response.data) if response.data else None

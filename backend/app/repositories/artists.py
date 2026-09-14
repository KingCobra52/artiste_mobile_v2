from typing import Protocol

from backend.app.schemas.artist import Artist


class ArtistsRepository(Protocol):
    async def list(self) -> list[Artist]: ...

    async def get(self, artist_id: str) -> Artist | None: ...

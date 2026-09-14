from backend.app.core.errors import DomainNotImplementedError
from backend.app.repositories.artists import ArtistsRepository
from backend.app.repositories.snapshots import SnapshotsRepository
from backend.app.schemas.artist import Artist
from backend.app.schemas.market import MarketQuote


class MarketService:
    def __init__(
        self,
        artists: ArtistsRepository | None = None,
        snapshots: SnapshotsRepository | None = None,
    ) -> None:
        self.artists = artists
        self.snapshots = snapshots

    async def list_artists(self) -> list[Artist]:
        raise DomainNotImplementedError()

    async def get_artist(self, artist_id: str) -> Artist:
        raise DomainNotImplementedError()

    async def list_quotes(self) -> list[MarketQuote]:
        raise DomainNotImplementedError()

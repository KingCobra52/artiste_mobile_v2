from backend.app.core.errors import AppError
from backend.app.repositories.artists import ArtistsRepository
from backend.app.repositories.snapshots import SnapshotsRepository
from backend.app.schemas.artist import Artist
from backend.app.schemas.market import MarketQuote, QuoteStatus


class MarketService:
    def __init__(
        self,
        artists: ArtistsRepository | None = None,
        snapshots: SnapshotsRepository | None = None,
    ) -> None:
        self.artists = artists
        self.snapshots = snapshots

    async def list_artists(self) -> list[Artist]:
        if self.artists is None:
            raise AppError(
                status_code=503,
                code="market_unavailable",
                message="The market is temporarily unavailable.",
            )
        return await self.artists.list()

    async def get_artist(self, artist_id: str) -> Artist:
        artist = await self.artists.get(artist_id) if self.artists else None
        if artist is None:
            raise AppError(status_code=404, code="artist_not_found", message="Artist not found.")
        return artist

    async def list_quotes(self) -> list[MarketQuote]:
        if self.artists is None or self.snapshots is None:
            raise AppError(
                status_code=503,
                code="market_unavailable",
                message="The market is temporarily unavailable.",
            )
        artists = await self.artists.list()
        available = {quote.artist_id: quote for quote in await self.snapshots.list_quotes()}
        return [
            available.get(
                artist.id,
                MarketQuote(artist_id=artist.id, status=QuoteStatus.UNAVAILABLE),
            )
            for artist in artists
        ]

    async def quote_for(self, artist_id: str) -> MarketQuote:
        await self.get_artist(artist_id)
        quote = next(
            (quote for quote in await self.list_quotes() if quote.artist_id == artist_id),
            None,
        )
        if quote is None:
            raise AppError(status_code=404, code="artist_not_found", message="Artist not found.")
        return quote

from fastapi import APIRouter, Path

from backend.app.api.dependencies import MarketServiceDep
from backend.app.schemas.artist import Artist
from backend.app.schemas.error import NOT_IMPLEMENTED_RESPONSE

router = APIRouter(prefix="/artists", tags=["artists"])


@router.get(
    "",
    response_model=list[Artist],
    responses=NOT_IMPLEMENTED_RESPONSE,
    summary="List artists",
)
async def list_artists(service: MarketServiceDep) -> list[Artist]:
    return await service.list_artists()


@router.get(
    "/{artist_id}",
    response_model=Artist,
    responses=NOT_IMPLEMENTED_RESPONSE,
    summary="Get an artist",
)
async def get_artist(
    service: MarketServiceDep,
    artist_id: str = Path(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$"),
) -> Artist:
    return await service.get_artist(artist_id)

from pydantic import BaseModel, ConfigDict


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class Artist(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)

    id: str
    name: str
    symbol: str
    genre: str

    biography: str = ""
    music_context: str = ""
    notable_releases: list[str] = []
    listening_url: str = ""
    image_url: str | None = None
    context_source_url: str = ""
    active: bool = True
    exclusion_reason: str | None = None

    @property
    def supported(self) -> bool:
        return self.active and bool(
            self.biography.strip()
            and self.music_context.strip()
            and self.listening_url.startswith("https://")
        )

from functools import lru_cache

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Validated process configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Artiste API"
    environment: str = "development"
    log_level: str = "INFO"
    supabase_url: AnyHttpUrl
    supabase_secret_key: str = Field(min_length=1)
    database_url: str | None = None
    lastfm_api_key: str | None = None
    youtube_api_key: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()

"""Lazy compatibility client for the synchronous ingestion pipelines."""

from typing import Any

from backend.app.core.config import get_settings
from supabase import Client, create_client


class LazySupabaseClient:
    def __init__(self) -> None:
        self._client: Client | None = None

    def _get_client(self) -> Client:
        if self._client is None:
            settings = get_settings()
            self._client = create_client(
                str(settings.supabase_url).rstrip("/"), settings.supabase_secret_key
            )
        return self._client

    def __getattr__(self, name: str) -> Any:
        return getattr(self._get_client(), name)


supabase = LazySupabaseClient()

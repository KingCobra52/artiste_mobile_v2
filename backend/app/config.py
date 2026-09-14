"""Compatibility exports for the existing ingestion pipelines."""

from backend.app.core.config import get_settings

_settings = get_settings()

database_url = _settings.database_url
supabase_url = str(_settings.supabase_url).rstrip("/")
supabase_secret_key = _settings.supabase_secret_key
lastfm_api_key = _settings.lastfm_api_key
yt_api_key = _settings.youtube_api_key

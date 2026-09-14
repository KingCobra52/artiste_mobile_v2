import pytest
from pydantic import ValidationError

from backend.app.core.config import Settings


def test_settings_require_supabase_configuration(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_do_not_turn_missing_optional_values_into_strings():
    settings = Settings(
        _env_file=None,
        supabase_url="http://localhost:54321",
        supabase_secret_key="test-secret",
    )

    assert settings.database_url is None
    assert settings.lastfm_api_key is None
    assert settings.youtube_api_key is None

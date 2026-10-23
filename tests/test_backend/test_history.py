from backend.app.services.history import price_history


def row(day, plays, subscribers=None, artist=1):
    return dict(
        artist_id=artist, snapshot_date=day, lastfm_playcount=plays, youtube_subscribers=subscribers
    )


def test_history_preserves_gaps_and_does_not_look_ahead():
    points = price_history([row("2026-01-01", 100), row("2026-01-04", 400)], "1")
    assert [p["date"] for p in points] == ["2026-01-01", "2026-01-04"]
    assert [p["valueCents"] for p in points] == [1000, 1158]


def test_history_filters_artist_and_invalid_signals():
    assert price_history([row("2026-01-01", 0), row("2026-01-02", 100, artist=2)], "1") == []


def test_history_retains_stale_source_date():
    points = price_history([row("2026-01-01", 100, 100), row("2026-01-05", 110)], "1")
    assert points[-1]["status"] == "stale"
    assert points[-1]["sourceDate"].startswith("2026-01-01")

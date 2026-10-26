from datetime import datetime, timezone

from backend.app.services.shadow_pricing import performance_shadow_quote
from pipelines.portfolio_snapshots import publish_anchors

NOW = datetime(2026, 10, 26, 12, tzinfo=timezone.utc)


def row(day, tracks=None, videos=None):
    return {
        "snapshot_date": day,
        "lastfm_tracks": tracks or {},
        "youtube_videos": videos or {},
    }


def test_matched_audience_growth_moves_shadow_index():
    quote = performance_shadow_quote(
        [
            row("2026-10-24", {"track": {"playcount": 1000, "listeners": 100}}),
            row("2026-10-25", {"track": {"playcount": 1100, "listeners": 110}}),
        ],
        now=NOW,
    )
    assert quote["performance_index_cents"] > 1000
    assert quote["sources"]["lastfm"]["matchedEntities"] == 1
    assert quote["status"] == "fresh"


def test_new_tracks_and_videos_do_not_manufacture_growth():
    quote = performance_shadow_quote(
        [
            row(
                "2026-10-24",
                {"old": {"playcount": 1000, "listeners": 100}},
                {"old-video": {"views": 1000, "likes": 100, "comments": 10}},
            ),
            row(
                "2026-10-25",
                {
                    "old": {"playcount": 1000, "listeners": 100},
                    "new": {"playcount": 999999, "listeners": 99999},
                },
                {
                    "old-video": {"views": 1000, "likes": 100, "comments": 10},
                    "new-video": {"views": 999999, "likes": 99999, "comments": 9999},
                },
            ),
        ],
        now=NOW,
    )
    assert quote["performance_index_cents"] == 1000


def test_future_observations_cannot_change_shadow_index_or_freshness():
    baseline = [
        row("2026-10-24", {"track": {"playcount": 1000}}),
        row("2026-10-25", {"track": {"playcount": 1100}}),
    ]
    expected = performance_shadow_quote(baseline, now=NOW)
    with_future = performance_shadow_quote(
        baseline + [row("2026-10-27", {"track": {"playcount": 1000000}})], now=NOW
    )
    assert with_future == expected


def test_source_gap_uses_elapsed_days_and_retains_its_prior_cohort():
    quote = performance_shadow_quote(
        [
            row("2026-10-23", {"track": {"playcount": 1000}}),
            row("2026-10-24", videos={"video": {"views": 10, "likes": 1}}),
            row("2026-10-25", {"track": {"playcount": 1210}}),
        ],
        now=NOW,
    )
    assert quote["performance_index_cents"] > 1000
    assert quote["sources"]["lastfm"]["updates"] == 1


def test_no_matched_source_is_unavailable():
    quote = performance_shadow_quote(
        [
            row("2026-10-24", {"old": {"playcount": 1}}),
            row("2026-10-25", {"new": {"playcount": 100}}),
        ],
        now=NOW,
    )
    assert quote["performance_index_cents"] is None
    assert quote["status"] == "unavailable"


def test_pipeline_persists_shadow_quotes_without_publishing_live_anchors():
    performance_rows = [
        {
            "artist_id": 7,
            "snapshot_date": "2026-10-24",
            "lastfm_tracks": {"track": {"playcount": 100}},
            "youtube_videos": {},
        },
        {
            "artist_id": 7,
            "snapshot_date": "2026-10-25",
            "lastfm_tracks": {"track": {"playcount": 120}},
            "youtube_videos": {},
        },
    ]

    class Query:
        def __init__(self, data):
            self.data = data

        def range(self, *_):
            return self

        def execute(self):
            return type("Response", (), {"data": self.data})()

    class Table:
        def __init__(self):
            self.rows = []

        def upsert(self, row, **_):
            self.rows.append(row)
            return self

        def execute(self):
            return None

    class Client:
        def __init__(self):
            self.shadow_table = Table()
            self.rpc_calls = []

        def rpc(self, name):
            self.rpc_calls.append(name)
            return Query(
                performance_rows if name == "get_performance_observations" else []
            )

        def table(self, name):
            assert name == "pricing_shadow_quotes"
            return self.shadow_table

    client = Client()
    assert publish_anchors(client) == 0
    assert client.rpc_calls == [
        "get_pricing_observations",
        "get_performance_observations",
        "get_market_snapshots",
    ]
    assert len(client.shadow_table.rows) == 1
    assert client.shadow_table.rows[0]["model_version"] == "performance-index-shadow-v1"
    assert client.shadow_table.rows[0]["performance_index_cents"] > 1000
    assert "publish_artist_anchor" not in client.rpc_calls

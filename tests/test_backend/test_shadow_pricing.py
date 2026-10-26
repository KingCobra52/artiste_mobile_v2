from datetime import datetime, timezone

from backend.app.services.shadow_pricing import performance_shadow_quote
from pipelines.portfolio_snapshots import _shadow_calculation_hash, publish_anchors

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
    assert quote["sources"]["lastfm"]["confidence"] == 0.1
    assert quote["status"] == "fresh"


def test_cohort_churn_does_not_create_growth():
    quote = performance_shadow_quote(
        [
            row("2026-10-24", {"old": {"playcount": 1000}}),
            row("2026-10-25", {"new": {"playcount": 999999}}),
        ],
        now=NOW,
    )
    assert quote["performance_index_cents"] is None
    assert quote["status"] == "unavailable"


def test_new_youtube_upload_does_not_create_view_growth():
    quote = performance_shadow_quote(
        [
            row(
                "2026-10-24",
                videos={"old": {"views": 1000, "likes": 100, "comments": 10}},
            ),
            row(
                "2026-10-25",
                videos={
                    "old": {"views": 1000, "likes": 100, "comments": 10},
                    "new": {"views": 999999, "likes": 99999, "comments": 9999},
                },
            ),
        ],
        now=NOW,
    )
    assert quote["performance_index_cents"] == 1000
    assert quote["sources"]["youtube"]["matchedEntities"] == 1


def test_mixed_source_freshness_withholds_the_combined_index():
    quote = performance_shadow_quote(
        [
            row("2026-10-01", {"track": {"playcount": 1000}}),
            row("2026-10-02", {"track": {"playcount": 1200}}),
            row("2026-10-24", videos={"video": {"views": 1000}}),
            row("2026-10-25", videos={"video": {"views": 1100}}),
        ],
        now=NOW,
    )
    assert quote["status"] == "stale"
    assert quote["performance_index_cents"] is None
    assert quote["sources"]["lastfm"]["included"] is False
    assert quote["sources"]["lastfm"]["excludedReason"] == "stale_source"
    assert quote["sources"]["youtube"]["included"] is False
    assert quote["sources"]["youtube"]["excludedReason"] == "another_source_stale"
    assert quote["source_as_of"] == datetime(2026, 10, 2, tzinfo=timezone.utc)


def test_a_stale_single_source_does_not_publish_a_fresh_index():
    quote = performance_shadow_quote(
        [
            row("2026-10-20", {"track": {"playcount": 1000}}),
            row("2026-10-21", {"track": {"playcount": 1100}}),
        ],
        now=NOW,
    )
    assert quote["status"] == "stale"
    assert quote["performance_index_cents"] is None


def test_fixed_source_weights_do_not_rescale_when_a_source_appears():
    lastfm_only = performance_shadow_quote(
        [
            row("2026-10-24", {"track": {"playcount": 1000}}),
            row("2026-10-25", {"track": {"playcount": 1020}}),
        ],
        now=NOW,
    )
    with_youtube = performance_shadow_quote(
        [
            row("2026-10-23", {"track": {"playcount": 1000}}),
            row("2026-10-24", {"track": {"playcount": 1020}}, {"video": {"views": 1000}}),
            row("2026-10-25", {"track": {"playcount": 1020}}, {"video": {"views": 1000}}),
        ],
        now=NOW,
    )
    assert lastfm_only["performance_index_cents"] == 1002
    assert with_youtube["performance_index_cents"] == lastfm_only["performance_index_cents"]


def test_single_track_confidence_dampens_its_price_contribution():
    sparse = performance_shadow_quote(
        [
            row("2026-10-24", {"track": {"playcount": 1000}}),
            row("2026-10-25", {"track": {"playcount": 1200}}),
        ],
        now=NOW,
    )
    broad = performance_shadow_quote(
        [
            row("2026-10-24", {f"track-{i}": {"playcount": 1000} for i in range(5)}),
            row("2026-10-25", {f"track-{i}": {"playcount": 1200} for i in range(5)}),
        ],
        now=NOW,
    )
    assert sparse["performance_index_cents"] < broad["performance_index_cents"]
    assert sparse["confidence"] < broad["confidence"]


def test_long_observation_gap_rebaselines_instead_of_annualizing():
    quote = performance_shadow_quote(
        [
            row("2026-07-01", {"track": {"playcount": 1000}}),
            row("2026-09-29", {"track": {"playcount": 1000000}}),
        ],
        now=datetime(2026, 9, 29, 12, tzinfo=timezone.utc),
    )
    assert quote["performance_index_cents"] is None
    assert quote["sources"]["lastfm"]["longGaps"] == 1
    assert quote["sources"]["lastfm"]["updates"] == 0


def test_a_large_one_day_outlier_is_capped_and_confidence_discounted():
    quote = performance_shadow_quote(
        [
            row("2026-10-24", {"track": {"playcount": 1000}}),
            row("2026-10-25", {"track": {"playcount": 1000000}}),
        ],
        now=NOW,
    )
    assert quote["sources"]["lastfm"]["cappedIntervals"] == 1
    assert quote["performance_index_cents"] <= 1005


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


def test_calculation_fingerprint_changes_when_freshness_state_changes():
    observations = [row("2026-10-24", {"track": {"playcount": 1000}})]
    fresh = {
        "performance_index_cents": 1000,
        "status": "fresh",
        "source_as_of": NOW,
        "confidence": 0.2,
        "sources": {"lastfm": {"included": True}},
    }
    stale = {**fresh, "performance_index_cents": None, "status": "stale"}
    assert _shadow_calculation_hash(observations, fresh) != _shadow_calculation_hash(
        observations, stale
    )


def test_pipeline_persists_unavailable_coverage_without_live_price_changes():
    performance_rows = [
        {
            "artist_id": 7,
            "snapshot_date": "2026-10-24",
            "lastfm_tracks": {"old": {"playcount": 100}},
            "youtube_videos": {},
        },
        {
            "artist_id": 7,
            "snapshot_date": "2026-10-25",
            "lastfm_tracks": {"new": {"playcount": 99999}},
            "youtube_videos": {},
        },
    ]

    class Query:
        def __init__(self, data):
            self.data = data

        def range(self, *_):
            return self

        def select(self, *_):
            return self

        def eq(self, *_):
            return self

        def order(self, *_):
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
            if name == "pricing_shadow_quotes":
                return self.shadow_table
            return Query([{"id": 7}])

    client = Client()
    assert publish_anchors(client) == 0
    assert client.rpc_calls == [
        "get_pricing_observations",
        "get_performance_observations",
        "get_market_snapshots",
    ]
    assert len(client.shadow_table.rows) == 1
    assert client.shadow_table.rows[0]["model_version"] == "performance-index-shadow-v2"
    assert client.shadow_table.rows[0]["performance_index_cents"] is None
    assert client.shadow_table.rows[0]["status"] == "unavailable"
    assert "publish_artist_anchor" not in client.rpc_calls


def test_shadow_schema_failure_does_not_block_live_anchor_publication(capsys):
    live_rows = [
        {
            "artist_id": 7,
            "snapshot_date": "2026-10-24",
            "lastfm_tracks": {"track": 1000},
            "youtube_subscribers": None,
        },
        {
            "artist_id": 7,
            "snapshot_date": "2026-10-25",
            "lastfm_tracks": {"track": 1100},
            "youtube_subscribers": None,
        },
    ]

    class Query:
        def __init__(self, data):
            self.data = data

        def range(self, *_):
            return self

        def select(self, *_):
            return self

        def eq(self, *_):
            return self

        def order(self, *_):
            return self

        def execute(self):
            return type("Response", (), {"data": self.data})()

    class Client:
        def __init__(self):
            self.calls = []

        def rpc(self, name, args=None):
            self.calls.append((name, args))
            if name == "get_pricing_observations":
                return Query(live_rows)
            if name == "get_performance_observations":
                raise RuntimeError("migration is missing")
            if name == "get_market_snapshots":
                return Query([])
            return Query([])

        def table(self, name):
            return Query([{"id": 7}])

    client = Client()
    assert publish_anchors(client) == 1
    assert any(name == "publish_artist_anchor" for name, _ in client.calls)
    assert "Shadow pricing publication unavailable (RuntimeError)." in capsys.readouterr().out

from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

from pipelines.reporting import category, execute_sources, summarize


def test_categories_do_not_persist_raw_exception_urls():
    assert category("HTTP 429 https://example.com?key=secret") == "quota_or_rate_limit"
    assert category("HTTP 403") == "authorization_or_quota"


def test_runner_distinguishes_partial_failure_and_records_each_artist():
    client = Mock()

    def collect(client, key, names):
        return [{"artist": names[0], "reason": "Timeout"}] if names[0] == "B" else []

    results, runs, outcomes, failed = execute_sources(
        client, [{"id": 1, "name": "A"}, {"id": 2, "name": "B"}], [("youtube", collect, "secret")]
    )
    assert not failed
    assert len(results[0][1]) == 1
    assert [row["status"] for row in outcomes] == ["success", "failed"]
    assert outcomes[-1]["category"] == "network_or_timeout"
    assert runs[0]["finished_at"] >= runs[0]["started_at"]


def test_crash_marks_remaining_artists_unattempted():
    client = Mock()

    def collect(*args):
        raise RuntimeError("secret upstream URL")

    results, runs, outcomes, _ = execute_sources(
        client, [{"id": 1, "name": "A"}, {"id": 2, "name": "B"}], [("lastfm", collect, "secret")]
    )
    assert results[0][2]
    assert [row["status"] for row in outcomes] == ["failed", "unattempted"]
    assert "secret" not in str(outcomes)


def test_rates_use_attempts_and_track_streaks_recoveries_and_hours():
    current = datetime(2026, 10, 23, 12, tzinfo=timezone.utc)
    runs, outcomes = [], []
    for i in range(4):
        stamp = (current - timedelta(days=3 - i)).isoformat()
        runs.append({"id": str(i), "source": "youtube", "scheduled_slot": "23 7 * * *"})
        for artist in (1, 2):
            outcomes.append(
                {
                    "run_id": str(i),
                    "artist_id": artist,
                    "started_at": stamp,
                    "finished_at": stamp,
                    "status": "failed" if artist == 1 or i < 2 else "success",
                }
            )
        outcomes.append(
            {
                "run_id": str(i),
                "artist_id": 3,
                "started_at": stamp,
                "finished_at": stamp,
                "status": "unattempted",
            }
        )
    result = summarize(runs, outcomes, current=current)
    source = next(row for row in result["windows"]["7"] if row["dimension"] == "source")
    assert source["attempts"] == 8
    assert source["failures"] == 6
    assert result["repeatedFailures"][0]["consecutiveFailures"] == 4
    assert len(result["recoveries"]) == 1
    assert any(
        row["value"].endswith("EDT")
        for row in result["windows"]["7"]
        if row["dimension"] == "actual_hour"
    )


def test_report_exposes_scope_durations_and_denominators(tmp_path, monkeypatch):
    import json
    from types import SimpleNamespace

    from pipelines.reporting import write_report

    class Query:
        def __getattr__(self, name):
            return lambda *args, **kwargs: self

        def execute(self):
            return SimpleNamespace(data=[])

    monkeypatch.chdir(tmp_path)
    client = Query()

    def collect(client, key, names):
        return [{"artist": names[0], "reason": "Timeout"}] if names[0] == "B" else []

    _, runs, outcomes, failed = execute_sources(
        client, [{"id": 1, "name": "A"}, {"id": 2, "name": "B"}], [("youtube", collect, "secret")]
    )
    assert not write_report(client, runs, outcomes, failed)
    report = json.loads((tmp_path / "reports/ingestion/current.json").read_text())
    assert report["currentRuns"][0]["durationSeconds"] >= 0
    assert all(row["durationSeconds"] >= 0 for row in report["currentOutcomes"])
    source = next(row for row in report["windows"]["7"] if row["dimension"] == "source")
    assert (source["failures"], source["attempts"], source["lowSample"]) == (1, 2, True)
    markdown = (tmp_path / "reports/ingestion/current.md").read_text()
    assert "some artists failed" in markdown
    assert "Duration" in markdown
    assert "secret" not in markdown

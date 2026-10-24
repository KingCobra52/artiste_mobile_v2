"""Durable source/artist outcomes and denominator-aware operational summaries."""

from __future__ import annotations

import json
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo


def now():
    return datetime.now(timezone.utc)


def category(reason: str) -> str:
    value = reason.lower()
    if "429" in value or "quota" in value or "rate" in value:
        return "quota_or_rate_limit"
    if "401" in value or "auth" in value:
        return "authentication"
    if "403" in value:
        return "authorization_or_quota"
    if "timeout" in value or "connection" in value:
        return "network_or_timeout"
    if "matching row" in value or "mapping" in value:
        return "missing_artist_mapping"
    if "database" in value or "postgrest" in value or "apierror" in value:
        return "database"
    return "invalid_response_or_processing"


def execute_sources(client, catalog, pipelines):
    runs, outcomes, results = [], [], []
    storage_failed = False

    def persist(table, row, update=False):
        nonlocal storage_failed
        try:
            query = client.table(table)
            (query.update(row).eq("id", row["id"]) if update else query.insert(row)).execute()
        except Exception:
            storage_failed = True

    for source, collect, key in pipelines:
        run = {
            "id": str(uuid4()),
            "source": source,
            "scheduled_slot": os.getenv("INGESTION_SCHEDULE", "manual"),
            "started_at": now().isoformat(),
            "expected": len(catalog),
            "crashed": False,
        }
        persist("ingestion_runs", run)
        failures, crashed = [], False
        for artist in catalog:
            start = now().isoformat()
            reason = None
            if crashed:
                status = "unattempted"
            else:
                try:
                    failed = collect(client, key, [artist["name"]])
                    reason = category(failed[0]["reason"]) if failed else None
                    status = "failed" if failed else "success"
                except Exception as exc:
                    reason = category(type(exc).__name__)
                    status, crashed = "failed", True
                if status == "failed":
                    failures.append({"artist": artist["name"], "reason": reason})
            outcome = {
                "run_id": run["id"],
                "artist_id": artist["id"],
                "artist_name": artist["name"],
                "started_at": start,
                "finished_at": now().isoformat(),
                "status": status,
                "category": reason,
            }
            outcomes.append(outcome)
            persist("ingestion_outcomes", outcome)
        run.update(finished_at=now().isoformat(), crashed=crashed)
        persist("ingestion_runs", run, update=True)
        runs.append(run)
        results.append((source, failures, crashed))
    return results, runs, outcomes, storage_failed


def _time(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def summarize(runs, outcomes, *, current=None):
    current = current or now()
    by_run = {run["id"]: run for run in runs}
    windows = {}
    artist_names = {
        str(row["artist_id"]): row.get("artist_name", str(row["artist_id"])) for row in outcomes
    }
    for days in (7, 30):
        groups = defaultdict(lambda: [0, 0])
        for outcome in outcomes:
            run = by_run.get(outcome["run_id"])
            if (
                not run
                or outcome["status"] == "unattempted"
                or not current - timedelta(days=days) <= _time(outcome["started_at"]) <= current
            ):
                continue
            hour = (
                _time(outcome["started_at"])
                .astimezone(ZoneInfo("America/New_York"))
                .strftime("%H:00 %Z")
            )
            for dimension, value in (
                ("artist", str(outcome["artist_id"])),
                ("scheduled_slot", run["scheduled_slot"]),
                ("actual_hour", hour),
                ("source", run["source"]),
            ):
                counts = groups[(run["source"], dimension, value)]
                counts[0] += 1
                counts[1] += outcome["status"] == "failed"
        windows[str(days)] = [
            {
                "source": source,
                "dimension": dimension,
                "value": value,
                "label": artist_names.get(value, value) if dimension == "artist" else value,
                "attempts": counts[0],
                "failures": counts[1],
                "failureRate": counts[1] / counts[0],
                "lowSample": counts[0] < 5,
            }
            for (source, dimension, value), counts in sorted(groups.items())
        ]
    histories = defaultdict(list)
    for outcome in outcomes:
        run = by_run.get(outcome["run_id"])
        if run and outcome["status"] != "unattempted":
            histories[(run["source"], outcome["artist_id"])].append(outcome)
    streaks, recoveries = [], []
    for (source, artist_id), history in histories.items():
        failed_since = None
        for outcome in sorted(history, key=lambda item: item["started_at"]):
            if outcome["status"] == "failed":
                failed_since = failed_since or outcome["started_at"]
            elif failed_since:
                recoveries.append(
                    {
                        "source": source,
                        "artistId": artist_id,
                        "artistName": artist_names.get(str(artist_id), str(artist_id)),
                        "recoveredAt": outcome["finished_at"],
                        "seconds": (
                            _time(outcome["finished_at"]) - _time(failed_since)
                        ).total_seconds(),
                    }
                )
                failed_since = None
        streak = 0
        for outcome in sorted(history, key=lambda item: item["started_at"], reverse=True):
            if outcome["status"] != "failed":
                break
            streak += 1
        if streak >= 3:
            streaks.append(
                {
                    "source": source,
                    "artistId": artist_id,
                    "artistName": artist_names.get(str(artist_id), str(artist_id)),
                    "consecutiveFailures": streak,
                }
            )
    return {
        "windows": windows,
        "repeatedFailures": streaks,
        "recoveries": recoveries,
        "timezone": "America/New_York",
        "unfinishedRuns": [row for row in runs if not row.get("finished_at")],
    }


def write_report(client, runs, outcomes, storage_failed=False):
    from pipelines.portfolio_snapshots import _all_rows

    cutoff = (now() - timedelta(days=30)).isoformat()
    try:
        historic_runs = _all_rows(
            client.table("ingestion_runs").select("*").gte("started_at", cutoff).order("started_at")
        )
        historic_outcomes = _all_rows(
            client.table("ingestion_outcomes")
            .select("*")
            .gte("started_at", cutoff)
            .order("started_at")
        )
    except Exception:
        historic_runs, historic_outcomes = runs, outcomes
        storage_failed = True
    # Include local events if persistence failed, without counting successful writes twice.
    historic_runs = list({row["id"]: row for row in historic_runs + runs}.values())
    historic_outcomes = list(
        {(row["run_id"], row["artist_id"]): row for row in historic_outcomes + outcomes}.values()
    )
    summary = summarize(historic_runs, historic_outcomes)

    def timed(row):
        return {
            **row,
            "durationSeconds": (
                (_time(row["finished_at"]) - _time(row["started_at"])).total_seconds()
                if row.get("finished_at")
                else None
            ),
        }

    summary.update(
        currentRuns=[timed(row) for row in runs],
        currentOutcomes=[timed(row) for row in outcomes],
        historyUnavailable=storage_failed,
    )
    lines = [
        "# Artiste ingestion report",
        "",
        "Times: America/New_York. Stored timestamps and scheduled cron slots: UTC.",
        "",
    ]
    for run in runs:
        rows = [row for row in outcomes if row["run_id"] == run["id"]]
        failed = sum(row["status"] == "failed" for row in rows)
        attempted = sum(row["status"] != "unattempted" for row in rows)
        scope = (
            "source crash"
            if run["crashed"]
            else "all artists failed"
            if failed and failed == attempted
            else "some artists failed"
            if failed
            else "all attempted artists succeeded"
            if attempted
            else "no artists attempted"
        )
        lines.extend(
            [
                f"## {run['source']}: {scope}",
                f"{failed}/{attempted} attempted failed; "
                f"{len(rows) - attempted} unattempted. Slot: {run['scheduled_slot']}",
                "Started "
                + _time(run["started_at"]).astimezone(ZoneInfo("America/New_York")).isoformat(),
                "Finished "
                + _time(run["finished_at"]).astimezone(ZoneInfo("America/New_York")).isoformat()
                + f" · Duration {timed(run)['durationSeconds']:.1f}s",
                "",
            ]
        )
        for row in rows:
            if row["status"] != "success":
                label = " ".join(row["artist_name"].split()).replace("|", "\\|")
                seconds = (_time(row["finished_at"]) - _time(row["started_at"])).total_seconds()
                lines.append(
                    f"- {label}: {row['status']} · "
                    f"{row['category'] or 'source stopped'} · {seconds:.1f}s"
                )
    for days in ("7", "30"):
        lines.extend(
            [
                "",
                f"## Last {days} days",
                "",
                "Source | Group | Value | Failed / attempted | Rate | Sample",
                "---|---|---|---|---|---",
            ]
        )
        for row in summary["windows"][days]:
            value = str(row.get("label", row["value"])).replace("|", "\\|").replace("\n", " ")
            lines.append(
                f"{row['source']} | {row['dimension']} | {value} | "
                f"{row['failures']}/{row['attempts']} | {row['failureRate']:.1%} | "
                f"{'Low (<5)' if row['lowSample'] else 'Observed'}"
            )
    lines.extend(
        [
            "",
            "Low sample counts are not evidence of a time-of-day pattern.",
            f"Repeated failures (three or more): {len(summary['repeatedFailures'])}",
            f"Recorded recoveries: {len(summary['recoveries'])}",
        ]
    )
    for row in summary["repeatedFailures"]:
        lines.append(
            f"- {row.get('artistName', row['artistId'])}: {row['source']} failed "
            f"{row['consecutiveFailures']} consecutive attempts"
        )
    for row in summary["recoveries"]:
        lines.append(
            f"- {row['artistName']}: {row['source']} recovered after "
            f"{row['seconds'] / 60:.1f} minutes at "
            + _time(row["recoveredAt"]).astimezone(ZoneInfo("America/New_York")).isoformat()
        )
    if summary["unfinishedRuns"]:
        lines.append(
            f"Unfinished source runs in this window: {len(summary['unfinishedRuns'])}. "
            "Inspect their expected and recorded artist counts in the JSON report."
        )
    if storage_failed:
        lines.append(
            "Durable reporting was unavailable; this report may contain only local observations."
        )
    root = Path("reports/ingestion")
    root.mkdir(parents=True, exist_ok=True)
    (root / "current.json").write_text(json.dumps(summary, indent=2))
    markdown = "\n".join(lines) + "\n"
    (root / "current.md").write_text(markdown)
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as output:
            output.write(markdown)
    if summary["repeatedFailures"]:
        print("::warning::Repeated partial ingestion failures. See the ingestion report.")
    return storage_failed

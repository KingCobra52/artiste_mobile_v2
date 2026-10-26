"""Experimental performance index, published for comparison only."""

from __future__ import annotations

import math
from datetime import date, datetime, time, timezone

from backend.app.services.pricing import BASE_PRICE_CENTS, FRESHNESS_WINDOW, MAX_DAILY_MOVE, utc_now

SHADOW_MODEL_VERSION = "performance-index-shadow-v1"
SOURCE_WEIGHTS = {"lastfm": 0.55, "youtube": 0.45}


def _positive(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) and number > 0 else None


def _growth(current, previous, elapsed_days):
    if current is None or previous is None or current <= 0 or previous <= 0:
        return None
    daily_return = math.exp(math.log(current / previous) / elapsed_days) - 1
    clipped_return = max(-MAX_DAILY_MOVE, min(MAX_DAILY_MOVE, daily_return))
    return math.log1p(clipped_return)


def _matched_lastfm(current, previous):
    shared = current.keys() & previous.keys()
    if not shared:
        return {}, 0
    result = {}
    for metric in ("playcount", "listeners"):
        now_total = sum(_positive(current[key].get(metric)) or 0 for key in shared)
        before_total = sum(_positive(previous[key].get(metric)) or 0 for key in shared)
        change = (now_total / before_total) if now_total and before_total else None
        result[metric] = change
    result["matchedTracks"] = len(shared)
    return result, len(shared)


def _matched_youtube(current, previous):
    shared = current.keys() & previous.keys()
    if not shared:
        return {}, 0
    totals = {"views": [0, 0], "engagement": [0, 0]}
    for video_id in shared:
        now, before = current[video_id], previous[video_id]
        for index, record in enumerate((before, now)):
            views = _positive(record.get("views")) or 0
            likes = _positive(record.get("likes")) or 0
            comments = _positive(record.get("comments")) or 0
            totals["views"][index] += views
            totals["engagement"][index] += likes + comments
    view_ratio = totals["views"][1] / totals["views"][0] if totals["views"][0] else None
    before_rate = totals["engagement"][0] / totals["views"][0] if totals["views"][0] else None
    after_rate = totals["engagement"][1] / totals["views"][1] if totals["views"][1] else None
    engagement_ratio = after_rate / before_rate if before_rate and after_rate else None
    return (
        {"views": view_ratio, "engagement": engagement_ratio, "matchedVideos": len(shared)},
        len(shared),
    )


def performance_shadow_quote(rows: list[dict], *, now: datetime | None = None) -> dict:
    """Build a shadow index from matched cohorts; it never feeds trade execution."""
    current_time = utc_now(now)
    ordered = []
    for row in rows:
        day = date.fromisoformat(str(row["snapshot_date"])[:10])
        if day > current_time.date():
            continue
        ordered.append((day, row))
    ordered.sort(key=lambda item: item[0])
    source_log_returns = {"lastfm": 0.0, "youtube": 0.0}
    source_updates = {"lastfm": 0, "youtube": 0}
    source_coverage = {"lastfm": 0, "youtube": 0}
    source_dates = {}
    previous_lastfm = None
    previous_youtube = None

    for day, row in ordered:
        lastfm = {
            key: value if isinstance(value, dict) else {"playcount": value}
            for key, value in (row.get("lastfm_tracks") or {}).items()
        }
        videos = row.get("youtube_videos") or {}
        if lastfm:
            if previous_lastfm:
                prior_day, prior_tracks = previous_lastfm
                elapsed = (day - prior_day).days
                if elapsed > 0:
                    lf, lf_count = _matched_lastfm(lastfm, prior_tracks)
                    lf_components = []
                    for metric in ("playcount", "listeners"):
                        ratio = lf.get(metric)
                        if ratio and ratio > 0:
                            lf_components.append(_growth(ratio, 1, elapsed))
                    if lf_components:
                        interval_growth = sum(lf_components) / len(lf_components)
                        source_log_returns["lastfm"] += max(
                            -MAX_DAILY_MOVE, min(MAX_DAILY_MOVE, interval_growth)
                        ) * elapsed
                        source_updates["lastfm"] += 1
                        source_coverage["lastfm"] = max(
                            source_coverage["lastfm"], lf_count
                        )
                        source_dates["lastfm"] = day
            previous_lastfm = (day, lastfm)
        if videos:
            if previous_youtube:
                prior_day, prior_videos = previous_youtube
                elapsed = (day - prior_day).days
                if elapsed > 0:
                    yt, yt_count = _matched_youtube(videos, prior_videos)
                    yt_components = []
                    for metric in ("views", "engagement"):
                        ratio = yt.get(metric)
                        if ratio and ratio > 0:
                            yt_components.append(_growth(ratio, 1, elapsed))
                    if yt_components:
                        interval_growth = sum(yt_components) / len(yt_components)
                        source_log_returns["youtube"] += max(
                            -MAX_DAILY_MOVE, min(MAX_DAILY_MOVE, interval_growth)
                        ) * elapsed
                        source_updates["youtube"] += 1
                        source_coverage["youtube"] = max(
                            source_coverage["youtube"], yt_count
                        )
                        source_dates["youtube"] = day
            previous_youtube = (day, videos)

    usable = [source for source, count in source_updates.items() if count]
    if not usable:
        return {
            "performance_index_cents": None,
            "status": "unavailable",
            "source_as_of": None,
            "confidence": 0.0,
            "sources": {},
            "model_version": SHADOW_MODEL_VERSION,
        }

    weighted_log_return = sum(
        SOURCE_WEIGHTS[source] * source_log_returns[source] for source in usable
    ) / sum(SOURCE_WEIGHTS[source] for source in usable)
    index = max(1, round(BASE_PRICE_CENTS * math.exp(weighted_log_return)))
    source_as_of = max(source_dates[source] for source in usable)
    as_of = datetime.combine(source_as_of, time.min, timezone.utc)
    status = "fresh" if current_time - as_of <= FRESHNESS_WINDOW else "stale"
    sources = {
        source: {
            "weight": SOURCE_WEIGHTS[source],
            "updates": source_updates[source],
            "matchedEntities": source_coverage[source],
            "included": source in usable,
            "asOf": source_dates[source].isoformat() if source in source_dates else None,
        }
        for source in source_updates
    }
    confidence = min(
        1.0,
        sum(SOURCE_WEIGHTS[source] * min(1.0, source_coverage[source] / 5) for source in usable)
        / sum(SOURCE_WEIGHTS[source] for source in usable),
    )
    if status != "fresh":
        confidence *= 0.5
    return {
        "performance_index_cents": index,
        "status": status,
        "source_as_of": as_of,
        "confidence": round(confidence, 4),
        "sources": sources,
        "model_version": SHADOW_MODEL_VERSION,
    }

"""Confidence-weighted artist performance index used by shadow and quote paths."""

from __future__ import annotations

import math
from datetime import date, datetime, time, timezone

from backend.app.services.pricing import BASE_PRICE_CENTS, FRESHNESS_WINDOW, MAX_DAILY_MOVE, utc_now

SHADOW_MODEL_VERSION = "performance-index-shadow-v2"
SOURCE_WEIGHTS = {"lastfm": 0.55, "youtube": 0.45}
MAX_COMPARISON_GAP_DAYS = 1
CONFIDENCE_SAMPLE_SIZE = 5


def _positive(value):
    try:
        number = float(value)
    except (OverflowError, TypeError, ValueError):
        return None
    return number if math.isfinite(number) and number > 0 else None


def _log_daily_growth(ratio: float, elapsed_days: int) -> tuple[float, bool]:
    daily_return = math.exp(math.log(ratio) / elapsed_days) - 1
    capped = abs(daily_return) > MAX_DAILY_MOVE
    daily_return = max(-MAX_DAILY_MOVE, min(MAX_DAILY_MOVE, daily_return))
    return math.log1p(daily_return), capped


def _lastfm_metrics(current, previous):
    shared = current.keys() & previous.keys()
    if not shared:
        return None, 0, None
    matched_plays = {
        key
        for key in shared
        if _positive(current[key].get("playcount"))
        and _positive(previous[key].get("playcount"))
    }
    current_plays = sum(_positive(current[key].get("playcount")) or 0 for key in matched_plays)
    previous_plays = sum(_positive(previous[key].get("playcount")) or 0 for key in matched_plays)
    current_listeners = sum(_positive(current[key].get("listeners")) or 0 for key in shared)
    previous_listeners = sum(_positive(previous[key].get("listeners")) or 0 for key in shared)
    play_ratio = current_plays / previous_plays if current_plays and previous_plays else None
    listener_ratio = (
        current_listeners / previous_listeners
        if current_listeners and previous_listeners
        else None
    )
    return play_ratio, len(matched_plays), listener_ratio


def _youtube_metrics(current, previous):
    shared = current.keys() & previous.keys()
    if not shared:
        return None, 0, None
    matched_views = {
        key
        for key in shared
        if _positive(current[key].get("views")) and _positive(previous[key].get("views"))
    }
    current_views = previous_views = 0.0
    current_engagement = previous_engagement = 0.0
    for video_id in matched_views:
        now, before = current[video_id], previous[video_id]
        current_views += _positive(now.get("views")) or 0
        previous_views += _positive(before.get("views")) or 0
        current_engagement += (_positive(now.get("likes")) or 0) + (
            _positive(now.get("comments")) or 0
        )
        previous_engagement += (_positive(before.get("likes")) or 0) + (
            _positive(before.get("comments")) or 0
        )
    view_ratio = current_views / previous_views if current_views and previous_views else None
    before_rate = previous_engagement / previous_views if previous_views else None
    after_rate = current_engagement / current_views if current_views else None
    engagement_ratio = after_rate / before_rate if before_rate and after_rate else None
    return view_ratio, len(matched_views), engagement_ratio


def _source_state():
    return {
        "log_return": 0.0,
        "latest_daily_log_return": 0.0,
        "updates": 0,
        "matched_entities": 0,
        "confidence_total": 0.0,
        "capped_intervals": 0,
        "long_gaps": 0,
        "latest_observation": None,
        "latest_matched_update": None,
        "listener_ratios": [],
        "engagement_ratios": [],
    }


def _add_interval(state, ratio, matched_entities, elapsed_days, day):
    if ratio is None or ratio <= 0:
        return
    daily_log_growth, capped = _log_daily_growth(ratio, elapsed_days)
    sample_confidence = min(1.0, matched_entities / CONFIDENCE_SAMPLE_SIZE)
    gap_confidence = min(1.0, MAX_COMPARISON_GAP_DAYS / elapsed_days)
    cap_confidence = 0.5 if capped else 1.0
    interval_confidence = sample_confidence * gap_confidence * cap_confidence
    state["log_return"] += daily_log_growth * elapsed_days * interval_confidence
    state["latest_daily_log_return"] = daily_log_growth * interval_confidence
    state["updates"] += 1
    state["matched_entities"] = max(state["matched_entities"], matched_entities)
    state["confidence_total"] += interval_confidence
    state["capped_intervals"] += int(capped)
    state["latest_matched_update"] = day


def _reset_source_after_gap(state):
    previous = state.copy()
    state.update(_source_state())
    state["long_gaps"] = previous["long_gaps"] + 1


def performance_shadow_quote(rows: list[dict], *, now: datetime | None = None) -> dict:
    """Build a confidence-weighted index and its latest daily movement.

    Missing/stale sources contribute neutral log-return, so adding or losing a
    source cannot rescale another source.
    """
    current_time = utc_now(now)
    ordered = []
    for row in rows:
        day = date.fromisoformat(str(row["snapshot_date"])[:10])
        if day <= current_time.date():
            ordered.append((day, row))
    ordered.sort(key=lambda item: item[0])

    states = {source: _source_state() for source in SOURCE_WEIGHTS}
    previous_lastfm = None
    previous_youtube = None

    for day, row in ordered:
        lastfm = {
            key: value if isinstance(value, dict) else {"playcount": value}
            for key, value in (row.get("lastfm_tracks") or {}).items()
        }
        videos = {
            key: value if isinstance(value, dict) else {}
            for key, value in (row.get("youtube_videos") or {}).items()
        }

        if lastfm:
            state = states["lastfm"]
            state["latest_observation"] = day
            if previous_lastfm:
                prior_day, prior_tracks = previous_lastfm
                elapsed = (day - prior_day).days
                if elapsed > 0:
                    if elapsed > MAX_COMPARISON_GAP_DAYS:
                        _reset_source_after_gap(state)
                        state["latest_observation"] = day
                    else:
                        ratio, matched, listener_ratio = _lastfm_metrics(lastfm, prior_tracks)
                        _add_interval(state, ratio, matched, elapsed, day)
                        if listener_ratio is not None:
                            state["listener_ratios"].append(listener_ratio)
            previous_lastfm = (day, lastfm)

        if videos:
            state = states["youtube"]
            state["latest_observation"] = day
            if previous_youtube:
                prior_day, prior_videos = previous_youtube
                elapsed = (day - prior_day).days
                if elapsed > 0:
                    if elapsed > MAX_COMPARISON_GAP_DAYS:
                        _reset_source_after_gap(state)
                        state["latest_observation"] = day
                    else:
                        ratio, matched, engagement_ratio = _youtube_metrics(
                            videos, prior_videos
                        )
                        _add_interval(state, ratio, matched, elapsed, day)
                        if engagement_ratio is not None:
                            state["engagement_ratios"].append(engagement_ratio)
            previous_youtube = (day, videos)

    for state in states.values():
        latest = state["latest_matched_update"]
        state["fresh"] = bool(
            latest
            and current_time
            - datetime.combine(latest, time.min, timezone.utc)
            <= FRESHNESS_WINDOW
        )
        state["confidence"] = (
            state["confidence_total"] / state["updates"] if state["updates"] else 0.0
        )

    fresh_sources = [source for source, state in states.items() if state["fresh"]]
    measured_sources = [source for source, state in states.items() if state["updates"]]
    all_measured_sources_fresh = bool(measured_sources) and all(
        states[source]["fresh"] for source in measured_sources
    )
    if all_measured_sources_fresh:
        # The denominator is fixed across all configured sources. An unavailable
        # source is neutral; it never amplifies the weight of the source present.
        weighted_log_return = sum(
            SOURCE_WEIGHTS[source] * states[source]["log_return"]
            for source in fresh_sources
        )
        index_cents = max(1, round(BASE_PRICE_CENTS * math.exp(weighted_log_return)))
        status = "fresh"
        source_as_of = min(states[source]["latest_matched_update"] for source in measured_sources)
        confidence = sum(
            SOURCE_WEIGHTS[source] * states[source]["confidence"] for source in fresh_sources
        ) / sum(SOURCE_WEIGHTS[source] for source in fresh_sources)
    elif measured_sources:
        index_cents = None
        status = "stale"
        source_as_of = min(states[source]["latest_matched_update"] for source in measured_sources)
        confidence = sum(
            SOURCE_WEIGHTS[source] * states[source]["confidence"] for source in measured_sources
        ) / sum(SOURCE_WEIGHTS[source] for source in measured_sources)
    else:
        index_cents = None
        status = "unavailable"
        source_as_of = max(
            (
                state["latest_observation"]
                for state in states.values()
                if state["latest_observation"]
            ),
            default=None,
        )
        confidence = 0.0

    sources = {}
    for source, state in states.items():
        included = status == "fresh" and source in fresh_sources
        sources[source] = {
            "weight": SOURCE_WEIGHTS[source],
            "included": included,
            "excludedReason": None
            if included
            else "stale_source"
            if state["updates"] and not state["fresh"]
            else "another_source_stale"
            if state["updates"] and status == "stale" and state["fresh"]
            else "no_matched_interval",
            "latestObservation": (
                state["latest_observation"].isoformat()
                if state["latest_observation"]
                else None
            ),
            "latestMatchedUpdate": (
                state["latest_matched_update"].isoformat()
                if state["latest_matched_update"]
                else None
            ),
            "updates": state["updates"],
            "matchedEntities": state["matched_entities"],
            "confidence": round(state["confidence"], 4),
            "confidenceWeightedLogReturn": round(state["log_return"], 8),
            "latestDailyConfidenceWeightedLogReturn": round(
                state["latest_daily_log_return"], 8
            ),
            "cappedIntervals": state["capped_intervals"],
            "longGaps": state["long_gaps"],
            "listenerGrowthDiagnostics": len(state["listener_ratios"]),
            "engagementGrowthDiagnostics": len(state["engagement_ratios"]),
        }

    as_of = (
        datetime.combine(source_as_of, time.min, timezone.utc) if source_as_of else None
    )
    return {
        "performance_index_cents": index_cents,
        "change_percent": (
            round(
                (math.exp(
                    sum(
                        SOURCE_WEIGHTS[source]
                        * states[source]["latest_daily_log_return"]
                        for source in fresh_sources
                    )
                )
                - 1)
                * 100,
                4,
            )
            if status == "fresh"
            else None
        ),
        "status": status,
        "source_as_of": as_of,
        "confidence": round(confidence, 4),
        "sources": sources,
        "model_version": SHADOW_MODEL_VERSION,
    }

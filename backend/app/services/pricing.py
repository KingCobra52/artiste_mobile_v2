"""Gap-aware audience anchors and a bounded inventory curve for virtual shares."""

from __future__ import annotations

import math
from collections.abc import Iterable
from datetime import date, datetime, time, timedelta, timezone
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal

BASE_PRICE_CENTS = 1_000
MAX_DAILY_MOVE = 0.05
FRESHNESS_WINDOW = timedelta(hours=48)
MODEL_VERSION = "audience-inventory-v2"
LIQUIDITY = 10_000
PREMIUM_LIMIT = 0.20
FEE_BPS = 10


def utc_now(now: datetime | None = None) -> datetime:
    value = now or datetime.now(timezone.utc)
    return (
        value.replace(tzinfo=timezone.utc)
        if value.tzinfo is None
        else value.astimezone(timezone.utc)
    )


def _observations(points: Iterable[tuple[date, int | None]], cutoff: date) -> dict[date, int]:
    return {
        day: value for day, value in points if day <= cutoff and value is not None and value > 0
    }


def calculate_quote(lastfm, youtube, *, now: datetime | None = None) -> dict:
    current = utc_now(now)
    observations = {
        "lastfm": _observations(lastfm, current.date()),
        "youtube": _observations(youtube, current.date()),
    }
    indices: dict[str, float] = {}
    previous: dict[str, tuple[date, int]] = {}
    returns: dict[str, float] = {}
    intervals: dict[str, int] = {}
    for day in sorted(set(observations["lastfm"]) | set(observations["youtube"])):
        for signal, series in observations.items():
            if day not in series:
                continue
            value = series[day]
            if signal not in previous:
                indices[signal] = float(BASE_PRICE_CENTS)
                returns[signal] = 0.0
            else:
                prior_day, prior_value = previous[signal]
                elapsed = (day - prior_day).days
                growth = max(
                    -MAX_DAILY_MOVE, min(MAX_DAILY_MOVE, (value / prior_value) ** (1 / elapsed) - 1)
                )
                indices[signal] *= (1 + growth) ** elapsed
                returns[signal] = growth
                intervals[signal] = elapsed
            previous[signal] = (day, value)
    if not previous:
        return {"price_cents": None, "change_percent": None, "as_of": None, "status": "unavailable"}
    as_of = datetime.combine(min(point[0] for point in previous.values()), time.min, timezone.utc)
    return {
        "price_cents": max(1, round(sum(indices.values()) / len(indices))),
        "change_percent": round(sum(returns.values()) / len(returns) * 100, 4),
        "as_of": as_of,
        "status": "fresh" if current - as_of <= FRESHNESS_WINDOW else "stale",
    }


def audience_quote(rows: list[dict], *, now: datetime | None = None) -> dict:
    """Chain matched-track returns; new top tracks cannot manufacture growth."""
    current = utc_now(now)
    lastfm, youtube = [], []
    prior_tracks: dict[str, int] = {}
    prior_day = None
    track_index = 1_000_000.0
    coverage = 0
    sources = {}
    for row in sorted(rows, key=lambda row: str(row["snapshot_date"])):
        day = date.fromisoformat(str(row["snapshot_date"])[:10])
        if day > current.date():
            continue
        tracks = {
            key: int(value)
            for key, value in (row.get("lastfm_tracks") or {}).items()
            if value is not None and int(value) > 0
        }
        if tracks:
            shared = tracks.keys() & prior_tracks.keys()
            coverage = len(shared)
            if shared and prior_day is not None:
                elapsed = (day - prior_day).days
                if elapsed > 0:
                    ratio = sum(tracks[key] for key in shared) / sum(
                        prior_tracks[key] for key in shared
                    )
                    growth = max(-MAX_DAILY_MOVE, min(MAX_DAILY_MOVE, ratio ** (1 / elapsed) - 1))
                    track_index *= (1 + growth) ** elapsed
                    lastfm.append((day, round(track_index)))
                    sources["lastfm"] = {
                        "asOf": day.isoformat(),
                        "matchedTracks": len(shared),
                        "elapsedDays": elapsed,
                    }
            elif prior_day is None:
                lastfm.append((day, round(track_index)))
            prior_tracks, prior_day = tracks, day
        value = row.get("youtube_subscribers")
        if value is not None and int(value) > 0:
            youtube.append((day, int(value)))
            sources["youtube"] = {"asOf": day.isoformat()}
    # A single baseline is not a measured audience signal. Do not dilute a
    # valid source with an unmeasured or completely disjoint source.
    if len(lastfm) < 2:
        lastfm = []
        sources.pop("lastfm", None)
    if len(youtube) < 2:
        youtube = []
        sources.pop("youtube", None)
    measured = {"lastfm": lastfm, "youtube": youtube}
    fresh = {
        source
        for source, series in measured.items()
        if series
        and current - datetime.combine(series[-1][0], time.min, timezone.utc) <= FRESHNESS_WINDOW
    }
    for source, series in measured.items():
        if source in sources:
            included = not fresh or source in fresh
            sources[source]["included"] = included
            if not included:
                sources[source]["excludedReason"] = "stale_source"
                measured[source] = []
    lastfm, youtube = measured["lastfm"], measured["youtube"]
    quote = calculate_quote(lastfm, youtube, now=current)
    quote.update(
        sources=sources,
        observation_count=len(set(day for day, _ in lastfm + youtube)),
        matched_tracks=coverage,
        pricing_version=MODEL_VERSION,
    )
    return quote


def marginal_price(anchor: float, inventory: int) -> float:
    return anchor * (1 + PREMIUM_LIMIT * math.tanh(inventory / LIQUIDITY))


def _log_cosh(value: float) -> float:
    return abs(value) + math.log1p(math.exp(-2 * abs(value))) - math.log(2)


def curve_order(anchor: int, inventory: int, quantity: int, side: str) -> dict:
    if anchor < 1 or quantity < 1 or quantity > 1_000_000 or side not in ("buy", "sell"):
        raise ValueError("Invalid virtual order")
    end = inventory + (quantity if side == "buy" else -quantity)
    integral = anchor * (
        end
        - inventory
        + PREMIUM_LIMIT
        * LIQUIDITY
        * (_log_cosh(end / LIQUIDITY) - _log_cosh(inventory / LIQUIDITY))
    )
    gross = int(
        Decimal(str(abs(integral))).to_integral_value(
            rounding=ROUND_CEILING if side == "buy" else ROUND_FLOOR
        )
    )
    fee = (gross * FEE_BPS + 9999) // 10000
    return {
        "gross_cents": gross,
        "fee_cents": fee,
        "total_cents": gross + fee if side == "buy" else max(0, gross - fee),
        "execution_price_cents": round(gross / quantity),
        "price_after_cents": round(marginal_price(anchor, end)),
    }

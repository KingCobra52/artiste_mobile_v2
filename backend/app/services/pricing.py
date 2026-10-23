from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime, time, timedelta, timezone

BASE_PRICE_CENTS = 1_000
MAX_DAILY_MOVE = 0.05
FRESHNESS_WINDOW = timedelta(hours=48)


def _observations(points: Iterable[tuple[date, int | None]]) -> dict[date, int]:
    observations: dict[date, int] = {}
    for day, value in points:
        if value is not None and value > 0:
            observations[day] = value
    return observations


def calculate_quote(
    lastfm: Iterable[tuple[date, int | None]],
    youtube: Iterable[tuple[date, int | None]],
    *,
    now: datetime | None = None,
) -> dict[str, int | float | datetime | str | None]:
    """Build a blended quote while keeping newly available signals from resetting it."""
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    current = current.astimezone(timezone.utc)

    observations = {
        "lastfm": _observations(lastfm),
        "youtube": _observations(youtube),
    }
    days = sorted(set(observations["lastfm"]) | set(observations["youtube"]))
    if not days:
        return {
            "price_cents": None,
            "change_percent": None,
            "as_of": None,
            "status": "unavailable",
        }

    indices: dict[str, float] = {}
    previous: dict[str, tuple[date, int]] = {}
    latest_returns: dict[str, float] = {}
    market_index = float(BASE_PRICE_CENTS)

    for day in days:
        updated: list[tuple[str, int]] = []
        first_observations: list[str] = []
        for signal, series in observations.items():
            value = series.get(day)
            if value is None:
                continue
            previous_point = previous.get(signal)
            if previous_point is None:
                first_observations.append(signal)
                updated.append((signal, value))
                continue

            previous_day, previous_value = previous_point
            elapsed_days = (day - previous_day).days
            if elapsed_days > 0:
                daily_return = ((value - previous_value) / previous_value) / elapsed_days
                daily_return = max(-MAX_DAILY_MOVE, min(MAX_DAILY_MOVE, daily_return))
                indices[signal] *= (1 + daily_return) ** elapsed_days
                latest_returns[signal] = daily_return
            updated.append((signal, value))

        # A signal that begins later inherits the current blended level instead
        # of introducing a price jump when it first enters the market.
        if first_observations:
            market_index = (
                sum(indices.values()) / len(indices) if indices else float(BASE_PRICE_CENTS)
            )
            for signal in first_observations:
                indices[signal] = market_index
                latest_returns[signal] = 0.0

        for signal, value in updated:
            previous[signal] = (day, value)
        if indices:
            market_index = sum(indices.values()) / len(indices)

    latest_days = [point[0] for point in previous.values()]
    as_of_day = min(latest_days)
    as_of = datetime.combine(as_of_day, time.min, timezone.utc)
    status = "fresh" if current - as_of <= FRESHNESS_WINDOW else "stale"
    change_percent = sum(latest_returns.values()) / len(latest_returns) * 100

    return {
        "price_cents": max(1, round(market_index)),
        "change_percent": round(change_percent, 4),
        "as_of": as_of,
        "status": status,
    }

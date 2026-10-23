"""Persist account values after a market-data refresh."""

from datetime import date, datetime, timezone

from backend.app.services.pricing import calculate_quote


def _all_rows(query) -> list[dict]:
    rows = []
    offset = 0
    while True:
        batch = query.range(offset, offset + 499).execute().data or []
        rows.extend(batch)
        if len(batch) < 500:
            return rows
        offset += 500


def _quotes(rows: list[dict]) -> dict[int, dict]:
    grouped: dict[int, dict[str, list[tuple[date, int | None]]]] = {}
    for row in rows:
        artist_id = int(row["artist_id"])
        bucket = grouped.setdefault(artist_id, {"lastfm": [], "youtube": []})
        day = row["snapshot_date"]
        if isinstance(day, str):
            day = date.fromisoformat(day)
        bucket["lastfm"].append((day, row.get("lastfm_playcount")))
        bucket["youtube"].append((day, row.get("youtube_subscribers")))
    return {
        artist_id: calculate_quote(signals["lastfm"], signals["youtube"])
        for artist_id, signals in grouped.items()
    }


def record_portfolio_valuations(client) -> int:
    """Record changed account valuations and return the number of new points."""
    market_rows = _all_rows(client.rpc("get_market_snapshots"))
    quotes = _quotes(market_rows)
    profiles = _all_rows(client.table("profiles").select("id,cash_cents"))
    positions = _all_rows(
        client.table("paper_positions").select("user_id,artist_id,quantity")
    )
    previous_rows = _all_rows(client.rpc("get_latest_portfolio_snapshots"))
    previous_by_user = {}
    for row in previous_rows:
        previous_by_user.setdefault(row["user_id"], row)

    positions_by_user: dict[str, list[dict]] = {}
    for row in positions:
        positions_by_user.setdefault(row["user_id"], []).append(row)

    quote_dates = [quote["as_of"] for quote in quotes.values() if quote["as_of"]]
    source_date = max(quote_dates) if quote_dates else datetime.now(timezone.utc)
    entries = []
    for profile in profiles:
        user_id = profile["id"]
        cash = int(profile["cash_cents"])
        holdings = 0
        incomplete = False
        stale = False
        for position in positions_by_user.get(user_id, []):
            quote = quotes.get(int(position["artist_id"]))
            if quote is None or quote["price_cents"] is None:
                incomplete = True
                stale = True
                continue
            holdings += int(position["quantity"]) * int(quote["price_cents"])
            stale = stale or quote["status"] != "fresh"

        holdings_value = None if incomplete else holdings
        total_value = None if incomplete else cash + holdings
        status = "stale" if stale else "fresh"
        old = previous_by_user.get(user_id)
        current_values = (cash, holdings_value, total_value, source_date.isoformat(), status)
        old_values = (
            old.get("cash_cents"),
            old.get("holdings_cents"),
            old.get("total_cents"),
            old.get("source_date"),
            old.get("status"),
        ) if old else None
        if current_values == old_values:
            continue
        entries.append({
            "user_id": user_id,
            "source": "quote_refresh",
            "cash_cents": cash,
            "holdings_cents": holdings_value,
            "total_cents": total_value,
            "source_date": source_date.isoformat(),
            "status": status,
        })

    for offset in range(0, len(entries), 500):
        client.table("paper_portfolio_snapshots").insert(entries[offset : offset + 500]).execute()
    return len(entries)

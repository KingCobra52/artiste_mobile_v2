"""Historical quotes reconstructed only at observed dates, never interpolated."""

from datetime import date, datetime, timezone

from backend.app.services.pricing import calculate_quote


def price_history(rows: list[dict], artist_id: str) -> list[dict]:
    rows = [r for r in rows if str(r["artist_id"]) == artist_id]
    days = sorted(
        {
            str(r["snapshot_date"])
            for r in rows
            if (r.get("lastfm_playcount") or 0) > 0 or (r.get("youtube_subscribers") or 0) > 0
        }
    )
    points = []
    for day in days:
        prefix = [r for r in rows if str(r["snapshot_date"]) <= day]
        quote = calculate_quote(
            [
                (date.fromisoformat(str(r["snapshot_date"])), r.get("lastfm_playcount"))
                for r in prefix
            ],
            [
                (date.fromisoformat(str(r["snapshot_date"])), r.get("youtube_subscribers"))
                for r in prefix
            ],
            now=datetime.fromisoformat(day).replace(tzinfo=timezone.utc),
        )
        points.append(
            {
                "date": day,
                "valueCents": quote["price_cents"],
                "status": quote["status"],
                "sourceDate": quote["as_of"].isoformat(),
            }
        )
    return points

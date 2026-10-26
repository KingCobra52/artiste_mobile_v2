"""Publish complete audience anchors, then record consistent account valuations."""

import hashlib
import json
from datetime import date

from backend.app.services.legacy_pricing import calculate_quote as legacy_quote
from backend.app.services.pricing import audience_quote, utc_now
from backend.app.services.shadow_pricing import performance_shadow_quote


def _shadow_calculation_hash(rows: list[dict], result: dict) -> str:
    payload = {
        "observations": rows,
        "result": {
            "index": result["performance_index_cents"],
            "status": result["status"],
            "source_as_of": (
                result["source_as_of"].isoformat() if result["source_as_of"] else None
            ),
            "confidence": result["confidence"],
            "sources": result["sources"],
        },
    }
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _all_rows(query) -> list[dict]:
    rows = []
    offset = 0
    while True:
        batch = query.range(offset, offset + 499).execute().data or []
        rows.extend(batch)
        if len(batch) < 500:
            return rows
        offset += 500


def _publish_shadow_quotes(client) -> int:
    """Write diagnostics without allowing shadow failures to block live quotes."""
    try:
        shadow_rows = {}
        for row in _all_rows(client.rpc("get_performance_observations")):
            shadow_rows.setdefault(int(row["artist_id"]), []).append(
                {
                    "snapshot_date": str(row["snapshot_date"]),
                    "lastfm_tracks": row.get("lastfm_tracks") or {},
                    "youtube_videos": row.get("youtube_videos") or {},
                }
            )
        active_artists = _all_rows(
            client.table("artists").select("id").eq("active", True).order("id")
        )
        artist_ids = {int(row["id"]) for row in active_artists} | set(shadow_rows)
        written = 0
        for artist_id in sorted(artist_ids):
            rows = shadow_rows.get(artist_id, [])
            shadow = performance_shadow_quote(rows)
            calculation_hash = _shadow_calculation_hash(rows, shadow)
            client.table("pricing_shadow_quotes").upsert(
                {
                    "artist_id": artist_id,
                    "model_version": shadow["model_version"],
                    "calculation_hash": calculation_hash,
                    "source_as_of": (
                        shadow["source_as_of"].isoformat()
                        if shadow["source_as_of"]
                        else None
                    ),
                    "performance_index_cents": shadow["performance_index_cents"],
                    "confidence": shadow["confidence"],
                    "status": shadow["status"],
                    "sources": shadow["sources"],
                },
                on_conflict="artist_id,model_version,calculation_hash",
                ignore_duplicates=True,
            ).execute()
            written += 1
        return written
    except Exception as exc:
        # Shadow evaluation must never interrupt established quote publication.
        print(f"Shadow pricing publication unavailable ({type(exc).__name__}).")
        return 0


def publish_anchors(client) -> int:
    grouped, legacy = {}, {}
    today = utc_now().date()
    for row in _all_rows(client.rpc("get_pricing_observations")):
        grouped.setdefault(int(row["artist_id"]), []).append(row)
    _publish_shadow_quotes(client)
    for row in _all_rows(client.rpc("get_market_snapshots")):
        if date.fromisoformat(str(row["snapshot_date"])[:10]) <= today:
            legacy.setdefault(int(row["artist_id"]), []).append(row)
    for artist_id, rows in grouped.items():
        quote = audience_quote(rows)
        if quote["price_cents"] is None or quote["observation_count"] < 2:
            continue
        old = legacy_quote(
            [
                (date.fromisoformat(str(row["snapshot_date"])[:10]), row.get("lastfm_playcount"))
                for row in legacy.get(artist_id, [])
            ],
            [
                (date.fromisoformat(str(row["snapshot_date"])[:10]), row.get("youtube_subscribers"))
                for row in legacy.get(artist_id, [])
            ],
        )
        client.rpc(
            "publish_artist_anchor",
            {
                "p_artist_id": artist_id,
                "p_raw": quote["price_cents"],
                "p_as_of": quote["as_of"].isoformat(),
                "p_sources": quote["sources"],
                "p_initial": old["price_cents"] or 1000,
            },
        ).execute()
    return len(grouped)


def record_portfolio_valuations(client) -> int:
    publish_anchors(client)
    profiles = _all_rows(client.table("profiles").select("id").order("id"))
    for profile in profiles:
        client.rpc(
            "capture_portfolio_v2",
            {"p_user_id": profile["id"], "p_source": "quote_refresh", "p_trade_id": None},
        ).execute()
    return len(profiles)

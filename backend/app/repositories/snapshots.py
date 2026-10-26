from datetime import datetime
from typing import Protocol

from backend.app.schemas.market import MarketQuote
from backend.app.services.pricing import audience_quote, utc_now
from supabase import AsyncClient


class SnapshotsRepository(Protocol):
    async def list_quotes(self) -> list[MarketQuote]: ...


async def all_rows(query) -> list[dict]:
    rows = []
    for offset in range(0, 10_000_000, 500):
        batch = (await query.range(offset, offset + 499).execute()).data or []
        rows.extend(batch)
        if len(batch) < 500:
            return rows
    raise RuntimeError("Snapshot result exceeds safety limit")


async def observations(client) -> list[dict]:
    return await all_rows(client.rpc("get_pricing_observations"))


class SupabaseSnapshotsRepository:
    def __init__(self, client: AsyncClient) -> None:
        self.client = client

    async def list_quotes(self) -> list[MarketQuote]:
        grouped: dict[str, list[dict]] = {}
        for row in await observations(self.client):
            grouped.setdefault(str(row["artist_id"]), []).append(row)
        states = {
            str(row["artist_id"]): row
            for row in await all_rows(self.client.table("artist_market_state").select("*"))
        }
        quotes = []
        for artist_id in sorted(grouped.keys() | states.keys()):
            calculated = audience_quote(grouped.get(artist_id, []))
            calculated.pop("matched_tracks")
            state = states.get(artist_id)
            if (
                state
                and state["source_as_of"]
                and datetime.fromisoformat(state["source_as_of"].replace("Z", "+00:00"))
                <= utc_now()
            ):
                calculated.update(
                    price_cents=state["price_cents"],
                    as_of=state["source_as_of"],
                    quote_version=str(state["version"]),
                    priced_at=state["priced_at"],
                    external_anchor_cents=round(float(state["anchor_cents"])),
                    demand_percent=float(state["demand_percent"]),
                    pricing_version=state.get("pricing_version", calculated["pricing_version"]),
                    sources=state.get("sources") or calculated["sources"],
                )
                if state.get("pricing_version") == "performance-index-v2":
                    source_change = (state.get("sources") or {}).get("change_percent")
                    calculated["change_percent"] = (
                        float(source_change) if source_change is not None else None
                    )
                from backend.app.services.pricing import FRESHNESS_WINDOW

                calculated["status"] = (
                    "fresh"
                    if utc_now()
                    - datetime.fromisoformat(state["source_as_of"].replace("Z", "+00:00"))
                    <= FRESHNESS_WINDOW
                    else "stale"
                )
            quotes.append(MarketQuote(artist_id=artist_id, **calculated))
        return quotes

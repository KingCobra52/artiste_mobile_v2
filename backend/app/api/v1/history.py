from datetime import datetime, timezone

from fastapi import APIRouter

from backend.app.api.dependencies import CurrentUserDep, PortfolioServiceDep, SupabaseDep
from backend.app.schemas.portfolio import Holding
from backend.app.services.history import price_history

router = APIRouter(tags=["history"])


@router.get("/artists/{artist_id}/history")
async def artist_history(artist_id: int, user: CurrentUserDep, client: SupabaseDep):
    from backend.app.repositories.snapshots import all_rows

    rows = await all_rows(client.rpc("get_market_snapshots"))
    recorded = await all_rows(
        client.table("published_quotes")
        .select("price_cents,source_as_of,observed_at,pricing_version")
        .eq("artist_id", artist_id)
        .lte("observed_at", datetime.now(timezone.utc).isoformat())
        .order("observed_at")
    )
    reconstructed = price_history(rows, str(artist_id))
    if recorded:
        reconstructed = [
            point for point in reconstructed if point["date"] < recorded[0]["observed_at"][:10]
        ]
    points = reconstructed + [
        {
            "date": row["observed_at"],
            "valueCents": row["price_cents"],
            "sourceDate": row["source_as_of"],
            "status": "fresh"
            if (
                datetime.fromisoformat(row["observed_at"].replace("Z", "+00:00"))
                - datetime.fromisoformat(row["source_as_of"].replace("Z", "+00:00"))
            ).total_seconds()
            <= 48 * 3600
            else "stale",
            "pricingVersion": row["pricing_version"],
        }
        for row in recorded
    ]
    return {
        "points": points,
        "description": (
            "Earlier observations are reconstructed audience prices. "
            "Version 2 points are recorded quotes with a bounded trading adjustment. "
            "Missing dates are not interpolated."
        ),
    }


@router.get("/portfolio/history")
async def portfolio_history(user: CurrentUserDep, service: PortfolioServiceDep):
    rows = await service.portfolios.history(user.id)
    return {
        "points": [
            {
                "date": row["observed_at"],
                "valueCents": row["total_cents"],
                "cashCents": row["cash_cents"],
                "holdingsCents": row["holdings_cents"],
                "sourceDate": row["source_date"],
                "status": row["status"],
                "holdings": [
                    Holding.model_validate(holding).model_dump(by_alias=True, mode="json")
                    for holding in row.get("holding_prices", [])
                ],
                "valuationVersion": row.get("valuation_version", "legacy-v1"),
            }
            for row in rows
        ],
        "description": (
            "Recorded portfolio valuations include virtual cash and holdings "
            "priced using the latest available quotes. Quote dates may be older "
            "than each observation. Points are saved after trades and when "
            "quotes change. Purchase-cost fallback begins with valuation version 2."
        ),
    }

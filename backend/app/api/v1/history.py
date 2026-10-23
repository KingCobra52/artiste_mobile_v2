from fastapi import APIRouter

from backend.app.api.dependencies import CurrentUserDep, PortfolioServiceDep, SupabaseDep
from backend.app.services.history import price_history

router = APIRouter(tags=["history"])


@router.get("/artists/{artist_id}/history")
async def artist_history(artist_id: int, user: CurrentUserDep, client: SupabaseDep):
    rows = []
    offset = 0
    while True:
        response = await client.rpc("get_market_snapshots").range(offset, offset + 499).execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < 500:
            break
        offset += 500
    return {
        "points": price_history(rows, str(artist_id)),
        "description": (
            'Reconstructed virtual prices at observed snapshot dates. Gaps are '
            'not daily prices. Historical signals may be revised by ingestion.'
        ),
    }


@router.get("/portfolio/history")
async def portfolio_history(user: CurrentUserDep, service: PortfolioServiceDep):
    await service.record_snapshot(user.id, "quote_refresh")
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
            }
            for row in rows
        ],
        "description": (
            'Recorded portfolio valuations include virtual cash and holdings '
            'priced using the latest available quotes. Quote dates may be older '
            'than each observation. Points are saved after trades and when this '
            'history is refreshed.'
        ),
    }

from fastapi import APIRouter

from backend.app.api.v1 import artists, history, market, portfolio, trades

router = APIRouter(prefix="/api/v1")
router.include_router(artists.router)
router.include_router(market.router)
router.include_router(portfolio.router)
router.include_router(trades.router)

router.include_router(history.router)

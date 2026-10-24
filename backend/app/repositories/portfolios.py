from typing import Protocol
from uuid import UUID

from backend.app.core.errors import AppError
from backend.app.repositories.snapshots import all_rows
from backend.app.schemas.portfolio import (
    Portfolio,
)
from backend.app.schemas.trade import TradeDraft, TradeResult
from supabase import AsyncClient


class PortfoliosRepository(Protocol):
    async def get(
        self,
        user_id: UUID,
    ) -> Portfolio: ...

    async def submit_trade(
        self,
        user_id: UUID,
        draft: TradeDraft,
        artist_database_id: int,
    ) -> TradeResult: ...

    async def find_trade(self, user_id: UUID, draft: TradeDraft) -> TradeResult | None: ...

    async def record_snapshot(
        self, user_id: UUID, portfolio: Portfolio, source: str, trade_id: int | None = None
    ) -> None: ...

    async def history(self, user_id: UUID) -> list[dict]: ...


class SupabasePortfoliosRepository:
    def __init__(self, client: AsyncClient) -> None:
        self.client = client

    async def get(
        self,
        user_id: UUID,
    ) -> Portfolio:
        response = await self.client.rpc("get_portfolio_v2", {"p_user_id": str(user_id)}).execute()
        if not response.data:
            raise AppError(
                status_code=409,
                code="profile_not_ready",
                message="Your portfolio is still being created. Try again shortly.",
            )
        return Portfolio.model_validate(response.data)

    async def submit_trade(
        self,
        user_id: UUID,
        draft: TradeDraft,
        artist_database_id: int,
    ) -> TradeResult:
        try:
            response = await self.client.rpc(
                "execute_market_trade",
                {
                    "p_user_id": str(user_id),
                    "p_artist_id": artist_database_id,
                    "p_side": draft.side.value,
                    "p_quantity": draft.quantity,
                    "p_quote_version": draft.quote_version,
                    "p_request_id": str(draft.request_id),
                },
            ).execute()
        except Exception as exc:
            message = str(exc)
            if "insufficient_cash" in message:
                raise AppError(
                    status_code=409,
                    code="insufficient_cash",
                    message="You do not have enough cash for this trade.",
                ) from exc
            if "insufficient_shares" in message:
                raise AppError(
                    status_code=409,
                    code="insufficient_shares",
                    message="You do not own enough shares for this trade.",
                ) from exc
            if "request_id_conflict" in message:
                raise AppError(
                    status_code=409,
                    code="request_id_conflict",
                    message="This request ID was already used for a different trade.",
                ) from exc
            for code, text in {
                "quote_changed": "The price changed. Review a new estimate.",
                "quote_not_tradable": "This quote is not current. Trading is unavailable.",
                "artist_unsupported": "This artist is not currently supported.",
                "pricing_shadow": "The new pricing engine is in preview mode. Trades are disabled.",
                "invalid_trade": "Check the trade details.",
                "order_too_small": "The order is too small after rounding and fees.",
            }.items():
                if code in message:
                    raise AppError(status_code=409, code=code, message=text) from exc
            raise AppError(
                status_code=503,
                code="trade_unavailable",
                message="Trading is temporarily unavailable.",
            ) from exc
        data = response.data
        if isinstance(data, list):
            data = data[0] if data else None
        if not data:
            raise AppError(
                status_code=503,
                code="trade_unavailable",
                message="Trading is temporarily unavailable.",
            )
        return TradeResult.model_validate(data)

    async def find_trade(self, user_id: UUID, draft: TradeDraft) -> TradeResult | None:
        response = (
            await self.client.table("paper_trades")
            .select("id,artist_id,side,quantity,execution_price_cents,total_cents")
            .eq("user_id", str(user_id))
            .eq("request_id", str(draft.request_id))
            .maybe_single()
            .execute()
        )
        row = response.data
        if not row:
            return None
        if (
            str(row["artist_id"]) != draft.artist_id
            or row["side"] != draft.side.value
            or int(row["quantity"]) != draft.quantity
        ):
            raise AppError(
                status_code=409,
                code="request_id_conflict",
                message="This request ID was already used for a different trade.",
            )
        profile_response = (
            await self.client.table("profiles")
            .select("cash_cents")
            .eq("id", str(user_id))
            .maybe_single()
            .execute()
        )
        return TradeResult(
            ok=True,
            code="accepted",
            message="Trade was already processed.",
            trade_id=int(row["id"]),
            execution_price_cents=int(row["execution_price_cents"]),
            total_cents=int(row["total_cents"]),
            cash_cents=int((profile_response.data or {}).get("cash_cents", 0)),
            idempotent=True,
        )

    async def record_snapshot(
        self, user_id: UUID, portfolio: Portfolio, source: str, trade_id: int | None = None
    ) -> None:
        await self.client.rpc(
            "capture_portfolio_v2",
            {"p_user_id": str(user_id), "p_source": source, "p_trade_id": trade_id},
        ).execute()

    async def history(self, user_id: UUID) -> list[dict]:
        return await all_rows(
            self.client.table("paper_portfolio_snapshots")
            .select(
                "observed_at,cash_cents,holdings_cents,total_cents,source_date,status,holding_prices,valuation_version"
            )
            .eq("user_id", str(user_id))
            .order("observed_at")
        )

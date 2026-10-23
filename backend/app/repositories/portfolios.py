from datetime import datetime, timezone
from typing import Protocol
from uuid import UUID

from backend.app.core.errors import AppError
from backend.app.schemas.artist import Artist
from backend.app.schemas.market import MarketQuote
from backend.app.schemas.portfolio import (
    Holding,
    Portfolio,
    PortfolioStatus,
    PortfolioSummary,
    TradeHistoryItem,
)
from backend.app.schemas.trade import TradeDraft, TradeResult
from supabase import AsyncClient


class PortfoliosRepository(Protocol):
    async def get(
        self,
        user_id: UUID,
        artists: list[Artist],
        quotes: list[MarketQuote],
    ) -> Portfolio: ...

    async def submit_trade(
        self,
        user_id: UUID,
        draft: TradeDraft,
        artist_database_id: int,
        price_cents: int,
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
        artists: list[Artist],
        quotes: list[MarketQuote],
    ) -> Portfolio:
        profile_response = (
            await self.client.table("profiles")
            .select("cash_cents")
            .eq("id", str(user_id))
            .maybe_single()
            .execute()
        )
        profile = profile_response.data
        if not profile:
            raise AppError(
                status_code=409,
                code="profile_not_ready",
                message="Your paper portfolio is still being created. Try again shortly.",
            )

        positions_response = (
            await self.client.table("paper_positions")
            .select("artist_id,quantity,average_cost_cents,first_purchased_at")
            .eq("user_id", str(user_id))
            .order("first_purchased_at")
            .execute()
        )
        history_response = (
            await self.client.table("paper_trades")
            .select("id,artist_id,side,quantity,execution_price_cents,total_cents,executed_at")
            .eq("user_id", str(user_id))
            .order("executed_at", desc=True)
            .limit(50)
            .execute()
        )

        artists_by_id = {artist.id: artist for artist in artists}
        quotes_by_id = {quote.artist_id: quote for quote in quotes}
        holdings: list[Holding] = []
        holdings_value = 0
        cost_basis = 0
        stale = False
        incomplete = False
        quote_dates = [quote.as_of for quote in quotes if quote.as_of]

        for row in positions_response.data or []:
            artist_id = str(row["artist_id"])
            artist = artists_by_id.get(artist_id)
            if artist is None:
                continue
            quote = quotes_by_id.get(artist_id)
            current_value = (
                quote.price_cents * int(row["quantity"])
                if quote and quote.price_cents is not None
                else None
            )
            if current_value is None or quote is None or quote.status != "fresh":
                stale = True
            if current_value is None:
                incomplete = True
            else:
                holdings_value += current_value
            quantity = int(row["quantity"])
            cost_basis += int(row["average_cost_cents"]) * quantity
            holdings.append(
                Holding(
                    artist=artist,
                    quantity=quantity,
                    average_cost_cents=int(row["average_cost_cents"]),
                    current_value_cents=current_value,
                    first_purchased_at=row["first_purchased_at"],
                )
            )

        trades: list[TradeHistoryItem] = []
        for row in history_response.data or []:
            artist = artists_by_id.get(str(row["artist_id"]))
            if artist:
                trades.append(
                    TradeHistoryItem(
                        id=int(row["id"]),
                        artist=artist,
                        side=row["side"],
                        quantity=int(row["quantity"]),
                        execution_price_cents=int(row["execution_price_cents"]),
                        total_cents=int(row["total_cents"]),
                        executed_at=row["executed_at"],
                    )
                )

        cash = int(profile["cash_cents"])
        return Portfolio(
            summary=PortfolioSummary(
                cash_cents=cash,
                holdings_value_cents=None if incomplete else holdings_value,
                total_value_cents=None if incomplete else cash + holdings_value,
                gain_loss_cents=None if incomplete else holdings_value - cost_basis,
                as_of=max(quote_dates) if quote_dates else datetime.now(timezone.utc),
                status=PortfolioStatus.STALE if stale else PortfolioStatus.FRESH,
            ),
            holdings=holdings,
            trades=trades,
        )

    async def submit_trade(
        self,
        user_id: UUID,
        draft: TradeDraft,
        artist_database_id: int,
        price_cents: int,
    ) -> TradeResult:
        try:
            response = await self.client.rpc(
                "execute_paper_trade",
                {
                    "p_user_id": str(user_id),
                    "p_artist_id": artist_database_id,
                    "p_side": draft.side.value,
                    "p_quantity": draft.quantity,
                    "p_price_cents": price_cents,
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
        summary = portfolio.summary
        source_date = summary.as_of.isoformat() if summary.as_of else None
        if source == "quote_refresh":
            latest = (
                await self.client.table("paper_portfolio_snapshots")
                .select("cash_cents,holdings_cents,total_cents,source_date,status")
                .eq("user_id", str(user_id))
                .order("observed_at", desc=True)
                .limit(1)
                .maybe_single()
                .execute()
            ).data
            if latest:
                latest_source_date = latest.get("source_date")
                if latest_source_date:
                    latest_source_date = datetime.fromisoformat(
                        latest_source_date.replace("Z", "+00:00")
                    ).isoformat()
                if (
                    int(latest["cash_cents"]) == summary.cash_cents
                    and latest["holdings_cents"] == summary.holdings_value_cents
                    and latest["total_cents"] == summary.total_value_cents
                    and latest_source_date == source_date
                    and latest["status"] == summary.status.value
                ):
                    return
        await self.client.table("paper_portfolio_snapshots").upsert({
            "user_id": str(user_id),
            "trade_id": trade_id,
            "source": source,
            "cash_cents": summary.cash_cents,
            "holdings_cents": summary.holdings_value_cents,
            "total_cents": summary.total_value_cents,
            "source_date": source_date,
            "status": summary.status.value,
        }, on_conflict="trade_id", ignore_duplicates=True).execute()

    async def history(self, user_id: UUID) -> list[dict]:
        response = (
            await self.client.table("paper_portfolio_snapshots")
            .select("observed_at,cash_cents,holdings_cents,total_cents,source_date,status")
            .eq("user_id", str(user_id))
            .order("observed_at")
            .limit(1000)
            .execute()
        )
        return response.data or []

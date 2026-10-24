import { HistorySection } from "@/components/ui/history-section";
import type { Metadata } from "next";
import { HoldingsList } from "@/components/portfolio/holdings-list";
import { ErrorState } from "@/components/ui/states";
import { formatDate, formatMoney, formatTimestamp } from "@/lib/format";
import { apiRequest, displayApiError } from "@/lib/api";
import type { Portfolio } from "@/types";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  let portfolio: Portfolio;
  try {
    portfolio = await apiRequest<Portfolio>("/api/v1/portfolio");
  } catch (error) {
    return (
      <ErrorState
        title="Portfolio unavailable"
        message={displayApiError(error)}
      />
    );
  }
  const { summary } = portfolio;

  return (
    <div className="space-y-5">
      <div className="portfolio-hero">
        <h1 className="portfolio-title">Your music portfolio</h1>
        <div className="portfolio-total mt-2 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Total account value</p>
            <p className="money-display mt-1 text-white">
              {formatMoney(summary.totalValueCents)}
            </p>
          </div>
          <p
            className={`pb-1 font-semibold ${summary.gainLossCents === null ? "text-slate-400" : summary.gainLossCents >= 0 ? "text-emerald-300" : "text-rose-300"}`}
          >
            {summary.gainLossCents === null
              ? "Unavailable"
              : `${summary.gainLossCents >= 0 ? "+" : "−"}${formatMoney(Math.abs(summary.gainLossCents))}`}
          </p>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Account calculated {formatTimestamp(summary.calculatedAt)} · Oldest
          held quote {formatTimestamp(summary.asOf)}
        </p>
      </div>
      <p className="text-xs text-slate-400">
        The signed amount is unrealized return on current holdings, including
        purchase fees.
      </p>
      {summary.status === "stale" && (
        <p
          role="status"
          className="rounded-xl bg-amber-300/10 p-3 text-sm text-amber-100"
        >
          Some holdings use stale quotes or purchase-cost fallbacks. See each
          holding below.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/8 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Cash</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {formatMoney(summary.cashCents)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Holdings</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {formatMoney(summary.holdingsValueCents)}
          </p>
        </div>
      </div>
      <HistorySection
        title="Total account performance"
        path="/api/v1/portfolio/history"
      />
      <HoldingsList holdings={portfolio.holdings} />
      <section aria-labelledby="history-title" className="space-y-3">
        <h2 id="history-title" className="text-lg font-semibold text-white">
          Recent trades
        </h2>
        {portfolio.trades.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 px-5 py-7 text-center text-sm text-slate-400">
            Your completed paper trades will appear here.
          </p>
        ) : (
          portfolio.trades.map((trade) => (
            <article
              key={trade.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-slate-900 p-4"
            >
              <div>
                <p className="font-semibold text-white">
                  {trade.side === "buy" ? "Bought" : "Sold"} {trade.artist.name}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {trade.quantity} shares at{" "}
                  {formatMoney(trade.executionPriceCents)} ·{" "}
                  {formatDate(trade.executedAt)}
                </p>
              </div>
              <p className="font-semibold tabular-nums text-white">
                {formatMoney(trade.totalCents)}
              </p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

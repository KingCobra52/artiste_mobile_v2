import type { Metadata } from "next";
import { HistorySection } from "@/components/ui/history-section";
import { HoldingsList } from "@/components/portfolio/holdings-list";
import { ErrorState } from "@/components/ui/states";
import { Icon } from "@/components/ui/icon";
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
    <div className="space-y-7">
      <div>
        <header className="portfolio-overview">
          <div>
            <p className="eyebrow">Your virtual collection</p>
            <h1 className="portfolio-title">Your music portfolio</h1>
            <div className="portfolio-value">
              <p className="small-copy">Total account value</p>
              <p className="money-display">
                {formatMoney(summary.totalValueCents)}
              </p>
            </div>
            <p
              className={`portfolio-return ${summary.gainLossCents === null ? "text-muted" : summary.gainLossCents >= 0 ? "positive" : "negative"}`}
            >
              {summary.gainLossCents === null
                ? "Return unavailable"
                : `${summary.gainLossCents >= 0 ? "+" : "−"}${formatMoney(Math.abs(summary.gainLossCents))}`}
              <span className="small-copy ml-2">Unrealized return</span>
            </p>
          </div>
          <dl className="account-split">
            <div>
              <dt className="small-copy">Available cash</dt>
              <dd>{formatMoney(summary.cashCents)}</dd>
            </div>
            <div>
              <dt className="small-copy">Holding value</dt>
              <dd>{formatMoney(summary.holdingsValueCents)}</dd>
            </div>
          </dl>
        </header>
        <div className="portfolio-timestamps">
          <p>Account calculated {formatTimestamp(summary.calculatedAt)}</p>
          <p>Oldest held quote {formatTimestamp(summary.asOf)}</p>
        </div>
        <p className="small-copy">
          Account value includes virtual cash and all holdings. Unrealized
          return compares current holdings with their purchase cost, including
          fees.
        </p>
      </div>
      {summary.status === "stale" && (
        <p role="status" className="notice">
          <Icon name="clock" />
          <span>
            Some holdings use stale quotes or purchase-cost fallbacks. Each
            holding below explains the value used.
          </span>
        </p>
      )}
      <HistorySection
        title="Total account performance"
        path="/api/v1/portfolio/history"
      />
      <HoldingsList holdings={portfolio.holdings} />
      <section aria-labelledby="history-title">
        <div className="section-heading">
          <h2 id="history-title" className="section-title">
            Recent trades
          </h2>
          <span className="small-copy">Completed paper trades</span>
        </div>
        {!portfolio.trades.length ? (
          <div className="state-panel">
            <p>Your completed paper trades will appear here.</p>
          </div>
        ) : (
          <ul className="trade-list">
            {portfolio.trades.map((trade) => (
              <li key={trade.id}>
                <span className="trade-type">
                  <Icon name={trade.side === "buy" ? "record" : "back"} />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">
                    {trade.side === "buy" ? "Bought" : "Sold"}{" "}
                    {trade.artist.name}
                  </p>
                  <p className="small-copy mt-1">
                    {trade.quantity} shares at{" "}
                    {formatMoney(trade.executionPriceCents)}
                  </p>
                  <p className="small-copy">{formatDate(trade.executedAt)}</p>
                </div>
                <p className="trade-amount">{formatMoney(trade.totalCents)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

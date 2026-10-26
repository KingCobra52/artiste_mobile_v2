import Link from "next/link";
import { EmptyState } from "@/components/ui/states";
import { Icon } from "@/components/ui/icon";
import { formatTimestamp, formatMoney } from "@/lib/format";
import type { Holding } from "@/types";
export function HoldingPrices({ holdings }: { holdings: Holding[] }) {
  return (
    <ul className="holding-price-notes">
      {holdings.map((holding) => (
        <li key={holding.artist.id}>
          <span className="font-semibold">{holding.artist.name}</span>
          <span className="text-muted">
            {holding.valuationBasis === "purchase_cost" ? (
              "Purchase cost used · No current market quote"
            ) : (
              <>
                {holding.valuationBasis === "stale_quote"
                  ? "Stale quote"
                  : "Last priced"}
                : {formatTimestamp(holding.quoteAsOf)}
                {holding.dataSourceAsOf && (
                  <span className="block mt-1">
                    Audience data {formatTimestamp(holding.dataSourceAsOf)}
                  </span>
                )}
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
function Purchases({ holding }: { holding: Holding }) {
  return (
    <details className="disclosure mt-4">
      <summary>Purchase history</summary>
      <ul className="space-y-3 mt-3 small-copy">
        {holding.purchases?.length ? (
          holding.purchases.map((purchase, index) => (
            <li key={`${purchase.date}-${index}`}>
              <p className="text-ink font-semibold">
                {purchase.quantity} shares at {formatMoney(purchase.priceCents)}
              </p>
              <p>{formatTimestamp(purchase.date)}</p>
              <p>
                Total {formatMoney(purchase.totalCents)} including{" "}
                {formatMoney(purchase.feeCents)} fee
              </p>
            </li>
          ))
        ) : (
          <li>
            Detailed purchases were not recorded for this earlier position.
          </li>
        )}
      </ul>
    </details>
  );
}
function HoldingNotice({ holding }: { holding: Holding }) {
  return (
    <>
      {holding.valuationBasis === "purchase_cost" && (
        <p className="small-copy text-warning mt-3">
          Valued at purchase cost—current quote unavailable.
        </p>
      )}
      {holding.valuationBasis === "stale_quote" && (
        <p className="small-copy text-warning mt-3">
          Uses a stale market quote.
        </p>
      )}
      {holding.costBasisMethod === "legacy_average" && (
        <p className="small-copy mt-3">
          Purchase cost uses the saved legacy average; a complete acquisition
          ledger is unavailable.
        </p>
      )}
    </>
  );
}
function cost(holding: Holding) {
  return holding.costBasisCents ?? holding.averageCostCents * holding.quantity;
}
export function HoldingsList({ holdings }: { holdings: Holding[] }) {
  if (!holdings.length)
    return (
      <EmptyState title="No holdings yet">
        Start with an artist’s story and music. Your holdings will appear here
        after a completed paper trade.
        <Link href="/market" className="text-link mt-3">
          Explore the Market <Icon name="arrow" />
        </Link>
      </EmptyState>
    );
  return (
    <section aria-labelledby="holdings-title">
      <div className="section-heading">
        <h2 id="holdings-title" className="section-title">
          Your holdings
        </h2>
        <p className="small-copy">Purchase cost includes execution fees.</p>
      </div>
      <ul className="holding-cards">
        {holdings.map((holding) => (
          <li key={holding.artist.id} className="panel">
            <div className="flex justify-between items-start gap-3">
              <div>
                <Link
                  className="touch inline-flex items-center font-semibold text-lg"
                  href={`/artists/${holding.artist.id}`}
                >
                  {holding.artist.name}
                </Link>
                <p className="small-copy">
                  {holding.artist.symbol} · {holding.quantity}{" "}
                  {holding.quantity === 1 ? "share" : "shares"}
                </p>
              </div>
              <Icon name="record" />
            </div>
            <dl className="holding-metrics">
              {[
                ["Avg. purchase cost", formatMoney(holding.averageCostCents)],
                ["Purchase value", formatMoney(cost(holding))],
                [
                  "Current unit value",
                  formatMoney(holding.currentPriceCents ?? null),
                ],
                ["Holding value", formatMoney(holding.currentValueCents)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <HoldingNotice holding={holding} />
            <dl className="holding-dates">
              {[
                ["Last priced", formatTimestamp(holding.quoteAsOf)],
                ["First purchased", formatTimestamp(holding.firstPurchasedAt)],
                [
                  "Last purchased",
                  formatTimestamp(
                    holding.lastPurchasedAt ?? holding.firstPurchasedAt,
                  ),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <Purchases holding={holding} />
          </li>
        ))}
      </ul>
      <div
        className="holdings-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Holdings details"
      >
        <table className="holdings-table">
          <caption className="sr-only">
            Holdings, purchase values and current quote timestamps
          </caption>
          <thead>
            <tr>
              {[
                "Artist / shares",
                "Purchase cost",
                "Current value",
                "Last priced",
                "Purchased",
                "History",
              ].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => (
              <tr key={holding.artist.id}>
                <th scope="row">
                  <Link
                    className="touch flex items-center font-semibold"
                    href={`/artists/${holding.artist.id}`}
                  >
                    {holding.artist.name}
                  </Link>
                  <p className="small-copy font-normal">
                    {holding.artist.symbol} · {holding.quantity} shares
                  </p>
                  <HoldingNotice holding={holding} />
                </th>
                <td>
                  <p className="data">{formatMoney(cost(holding))}</p>
                  <p className="small-copy mt-2">
                    {formatMoney(holding.averageCostCents)} avg. / share
                  </p>
                </td>
                <td>
                  <p className="data">
                    {formatMoney(holding.currentValueCents)}
                  </p>
                  <p className="small-copy mt-2">
                    {formatMoney(holding.currentPriceCents ?? null)} / share
                  </p>
                </td>
                <td>
                  <p className="small-copy">
                    {formatTimestamp(holding.quoteAsOf)}
                  </p>
                </td>
                <td>
                  <p className="small-copy">
                    First {formatTimestamp(holding.firstPurchasedAt)}
                  </p>
                  <p className="small-copy mt-2">
                    Latest{" "}
                    {formatTimestamp(
                      holding.lastPurchasedAt ?? holding.firstPurchasedAt,
                    )}
                  </p>
                </td>
                <td>
                  <Purchases holding={holding} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

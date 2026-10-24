import Link from "next/link";
import { EmptyState } from "@/components/ui/states";
import { formatTimestamp, formatMoney } from "@/lib/format";
import type { Holding } from "@/types";
export function HoldingPrices({ holdings }: { holdings: Holding[] }) {
  return (
    <ul className="mt-3 space-y-2 text-xs text-slate-300">
      {holdings.map((holding) => (
        <li key={holding.artist.id}>
          <span className="font-semibold">{holding.artist.name}</span> ·{" "}
          {holding.valuationBasis === "purchase_cost"
            ? "Purchase cost used · No current market quote"
            : `${holding.valuationBasis === "stale_quote" ? "Stale quote" : "Last priced"}: ${formatTimestamp(holding.quoteAsOf)}${holding.dataSourceAsOf ? ` · Audience data ${formatTimestamp(holding.dataSourceAsOf)}` : ""}`}
        </li>
      ))}
    </ul>
  );
}
function Purchases({ holding }: { holding: Holding }) {
  return (
    <details>
      <summary className="touch cursor-pointer text-sm text-sky-200">
        Purchase history
      </summary>
      <ul className="mt-2 space-y-3 text-xs text-slate-300">
        {holding.purchases?.length ? (
          holding.purchases.map((purchase, index) => (
            <li key={`${purchase.date}-${index}`}>
              {purchase.quantity} shares at {formatMoney(purchase.priceCents)} ·{" "}
              {formatTimestamp(purchase.date)}
              <br />
              Total {formatMoney(purchase.totalCents)} including{" "}
              {formatMoney(purchase.feeCents)} fee
            </li>
          ))
        ) : (
          <li>
            Detailed purchases were not recorded for this legacy position.
          </li>
        )}
      </ul>
    </details>
  );
}
function values(holding: Holding) {
  return [
    ["Shares", String(holding.quantity)],
    ["Avg. purchase cost", formatMoney(holding.averageCostCents)],
    [
      "Purchase value",
      formatMoney(
        holding.costBasisCents ?? holding.averageCostCents * holding.quantity,
      ),
    ],
    ["Current unit value", formatMoney(holding.currentPriceCents ?? null)],
    ["Holding value", formatMoney(holding.currentValueCents)],
    ["Last priced", formatTimestamp(holding.quoteAsOf)],
    ["First purchased", formatTimestamp(holding.firstPurchasedAt)],
    [
      "Last purchased",
      formatTimestamp(holding.lastPurchasedAt ?? holding.firstPurchasedAt),
    ],
  ];
}
export function HoldingsList({ holdings }: { holdings: Holding[] }) {
  if (!holdings.length)
    return (
      <EmptyState title="No holdings yet">
        Research a supported artist before reviewing a paper trade.
        <Link
          className="touch action-primary mx-auto mt-5 flex w-fit items-center rounded-xl px-5"
          href="/market"
        >
          Explore the Market →
        </Link>
      </EmptyState>
    );
  return (
    <section aria-labelledby="holdings-title">
      <h2 id="holdings-title" className="mb-4 text-xl font-semibold">
        Your holdings
      </h2>
      <p className="mb-4 text-xs text-slate-400">
        Average purchase cost includes execution fees. Quotes and purchase-cost
        fallbacks are identified separately.
      </p>
      <ul className="space-y-4 md:hidden">
        {holdings.map((holding) => (
          <li
            key={holding.artist.id}
            className="rounded-2xl border border-white/10 bg-slate-900 p-5"
          >
            <Link
              className="touch flex items-center text-lg font-semibold"
              href={`/artists/${holding.artist.id}`}
            >
              {holding.artist.name}
            </Link>
            <dl className="mt-3 space-y-3 text-sm">
              {values(holding).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="max-w-[60%] text-right tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {holding.valuationBasis === "purchase_cost" && (
              <p className="mt-4 text-sm text-amber-100">
                Valued at purchase cost—current quote unavailable.
              </p>
            )}
            {holding.valuationBasis === "stale_quote" && (
              <p className="mt-4 text-sm text-amber-100">
                Uses a stale market quote.
              </p>
            )}
            {holding.costBasisMethod === "legacy_average" && (
              <p className="mt-3 text-xs text-slate-400">
                Purchase cost uses the saved legacy average; a complete
                acquisition ledger is unavailable.
              </p>
            )}
            <Purchases holding={holding} />
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-2xl border border-white/10 md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Holdings, purchase values and current quote timestamps
          </caption>
          <thead>
            <tr>
              {[
                "Artist",
                ...values(holdings[0]).map(([label]) => label),
                "Purchases",
              ].map((label) => (
                <th
                  key={label}
                  className="whitespace-nowrap p-3 font-medium text-slate-400"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => (
              <tr key={holding.artist.id} className="border-t border-white/10">
                <th scope="row" className="min-w-40 p-3">
                  <Link
                    className="touch flex items-center"
                    href={`/artists/${holding.artist.id}`}
                  >
                    {holding.artist.name}
                  </Link>
                  {holding.valuationBasis !== "quote" && (
                    <span className="text-xs font-normal text-amber-100">
                      {holding.valuationBasis === "purchase_cost"
                        ? "Valued at purchase cost—current quote unavailable."
                        : "Stale quote"}
                    </span>
                  )}
                </th>
                {values(holding).map(([label, value]) => (
                  <td key={label} className="min-w-28 p-3 tabular-nums">
                    {value}
                  </td>
                ))}
                <td className="min-w-48 p-3">
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

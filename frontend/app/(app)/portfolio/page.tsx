import type { Metadata } from "next";
import { HoldingsList } from "@/components/portfolio/holdings-list";
import { PortfolioAllocationPlaceholder } from "@/components/portfolio/portfolio-allocation-placeholder";
import { PortfolioValuePlaceholder } from "@/components/portfolio/portfolio-value-placeholder";
import { SampleDataNotice } from "@/components/ui/sample-data-notice";
import { formatDate, formatMoney } from "@/lib/format";
import { holdings, portfolioAllocation, portfolioSeries, portfolioSummary } from "@/lib/placeholder-data";

export const metadata: Metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-200">Portfolio</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Total value</p>
            <h1 className="mt-1 text-4xl font-bold tracking-tight text-white">{formatMoney(portfolioSummary.totalValueCents)}</h1>
          </div>
          <p className="pb-1 font-semibold text-emerald-300">+{formatMoney(portfolioSummary.gainLossCents)}</p>
        </div>
        <p className="mt-3 text-sm text-slate-500">As of {formatDate(portfolioSummary.asOf)}</p>
      </div>
      <SampleDataNotice />
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/8 bg-slate-900 p-4"><p className="text-sm text-slate-400">Cash</p><p className="mt-1 text-lg font-semibold text-white">{formatMoney(portfolioSummary.cashCents)}</p></div>
        <div className="rounded-2xl border border-white/8 bg-slate-900 p-4"><p className="text-sm text-slate-400">Holdings</p><p className="mt-1 text-lg font-semibold text-white">{formatMoney(portfolioSummary.holdingsValueCents)}</p></div>
      </div>
      <PortfolioValuePlaceholder series={portfolioSeries} />
      <PortfolioAllocationPlaceholder allocations={portfolioAllocation} />
      <HoldingsList holdings={holdings} />
    </div>
  );
}

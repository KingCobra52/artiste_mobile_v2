import { EmptyState } from "@/components/ui/states";
import { formatDate, formatMoney } from "@/lib/format";
import type { PortfolioSeriesPoint } from "@/types";

export function PortfolioValuePlaceholder({ series }: { series: PortfolioSeriesPoint[] }) {
  if (series.length === 0) {
    return <EmptyState title="No value history yet">Your portfolio history will appear after the first valuation.</EmptyState>;
  }

  const maximum = Math.max(...series.map((point) => point.valueCents));
  return (
    <section aria-labelledby="value-history-title" className="rounded-2xl border border-white/8 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 id="value-history-title" className="font-semibold text-white">Value history</h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">Chart coming later</span>
      </div>
      <div className="mt-6 flex h-32 items-end gap-3" aria-label="Portfolio value history">
        {series.map((point) => (
          <div key={point.date} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <span className="sr-only">{formatDate(point.date)}: {formatMoney(point.valueCents)}</span>
            <div className="w-full rounded-t-md bg-gradient-to-t from-emerald-600 to-lime-300" style={{ height: `${Math.max(18, (point.valueCents / maximum) * 100)}%` }} />
            <span className="text-xs text-slate-500">{point.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

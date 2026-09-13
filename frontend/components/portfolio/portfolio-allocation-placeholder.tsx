import { EmptyState } from "@/components/ui/states";
import { formatMoney } from "@/lib/format";
import type { PortfolioAllocation } from "@/types";

export function PortfolioAllocationPlaceholder({ allocations }: { allocations: PortfolioAllocation[] }) {
  if (allocations.length === 0) {
    return <EmptyState title="No allocation yet">Buy an artist to see how your holdings are divided.</EmptyState>;
  }

  return (
    <section aria-labelledby="allocation-title" className="rounded-2xl border border-white/8 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 id="allocation-title" className="font-semibold text-white">Allocation</h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">Chart coming later</span>
      </div>
      <ul className="mt-5 space-y-4">
        {allocations.map((allocation) => (
          <li key={allocation.artistId}>
            <div className="mb-2 flex items-center justify-between gap-4 text-sm">
              <span className="font-medium text-slate-200">{allocation.label}</span>
              <span className="text-slate-400">{allocation.percentage.toFixed(1)}% · {formatMoney(allocation.valueCents)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-lime-300" style={{ width: `${allocation.percentage}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

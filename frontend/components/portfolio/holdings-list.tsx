import Link from "next/link";
import { EmptyState } from "@/components/ui/states";
import { formatDate, formatMoney } from "@/lib/format";
import type { Holding } from "@/types";

export function HoldingsList({ holdings }: { holdings: Holding[] }) {
  if (holdings.length === 0) {
    return <EmptyState title="No holdings yet">Browse the Market to find your first artist.</EmptyState>;
  }

  return (
    <section aria-labelledby="holdings-title">
      <h2 id="holdings-title" className="mb-3 text-lg font-semibold text-white">Holdings</h2>
      <div className="space-y-3">
        {holdings.map((holding) => (
          <Link key={holding.artist.id} href={`/artists/${holding.artist.id}`} className="block min-h-24 rounded-2xl border border-white/8 bg-slate-900 p-4 hover:border-lime-300/30">
            <div className="flex justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white">{holding.artist.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{holding.quantity} shares · Avg. {formatMoney(holding.averageCostCents)}</p>
              </div>
              <p className="font-semibold text-white">{formatMoney(holding.currentValueCents)}</p>
            </div>
            <p className="mt-3 text-xs text-slate-500">First bought {formatDate(holding.firstPurchasedAt)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import { MarketList } from "@/components/market/market-list";
import { SampleDataNotice } from "@/components/ui/sample-data-notice";
import { EmptyState } from "@/components/ui/states";
import { artists, quotes } from "@/lib/placeholder-data";

export const metadata: Metadata = { title: "Market" };

export default function MarketPage() {
  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-200">Market</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Find your next artist</h1>
        <p className="mt-2 text-slate-400">Daily virtual prices based on audience growth.</p>
      </div>
      <SampleDataNotice />
      <div className="mt-5">
        {artists.length > 0 ? <MarketList artists={artists} quotes={quotes} /> : <EmptyState title="The market is empty">Artists will appear after the first data sync.</EmptyState>}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { MarketList } from "@/components/market/market-list";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { apiRequest, displayApiError } from "@/lib/api";
import type { Artist, MarketQuote } from "@/types";

export const metadata: Metadata = { title: "Market" };

export default async function MarketPage() {
  let artists: Artist[] = [];
  let quotes: MarketQuote[] = [];
  let error: string | null = null;
  try {
    [artists, quotes] = await Promise.all([
      apiRequest<Artist[]>("/api/v1/artists"),
      apiRequest<MarketQuote[]>("/api/v1/market"),
    ]);
  } catch (caught) {
    error = displayApiError(caught);
  }

  return (
    <div>
      <div className="page-intro">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-200">Market</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Find your next artist</h1>
        <p className="mt-2 text-slate-400">Follow the music. Explore virtual prices powered by audience growth.</p>
      </div>
      <div className="mt-5">
        {error ? <ErrorState title="Market unavailable" message={error} /> : artists.length > 0 ? <MarketList artists={artists} quotes={quotes} /> : <EmptyState title="The market is empty">Artists will appear after the first data sync.</EmptyState>}
      </div>
    </div>
  );
}

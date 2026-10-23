import { HistorySection } from "@/components/ui/history-section";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtistOverview } from "@/components/artist/artist-overview";
import { TradePanel } from "@/components/trade/trade-panel";
import { ErrorState, StaleDataNotice } from "@/components/ui/states";
import { apiRequest, ApiError, displayApiError } from "@/lib/api";
import type { Artist, MarketQuote, Portfolio } from "@/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Artist" };
}

export default async function ArtistPage({ params }: { params: Promise<{ artistId: string }> }) {
  const { artistId } = await params;
  let artists: Artist[];
  let quotes: MarketQuote[];
  let portfolio: Portfolio;
  try {
    [artists, quotes, portfolio] = await Promise.all([
      apiRequest<Artist[]>("/api/v1/artists"),
      apiRequest<MarketQuote[]>("/api/v1/market"),
      apiRequest<Portfolio>("/api/v1/portfolio"),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return <ErrorState title="Artist unavailable" message={displayApiError(error)} />;
  }
  const artist = artists.find((item) => item.id === artistId);
  const quote = quotes.find((item) => item.artistId === artistId);
  if (!artist || !quote) notFound();
  const availablePosition = portfolio.holdings.find((holding) => holding.artist.id === artistId)?.quantity ?? 0;

  return (
    <div className="space-y-5">
      <Link href="/market" className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-400 hover:text-white">← Back to Market</Link>
      <div className="artist-layout space-y-5 lg:space-y-0">
        <div className="space-y-5">
          <ArtistOverview artist={artist} quote={quote} />
          <HistorySection title="Price history" path={`/api/v1/artists/${artist.id}/history`} />
          {quote.status !== "fresh" && <StaleDataNotice date={quote.asOf} status={quote.status} />}
        </div>
        <TradePanel artist={artist} currentQuote={quote} availablePosition={availablePosition} />
      </div>
      <section className="border-t border-white/10 pt-5">
        <h2 className="text-sm font-semibold text-white">Made for discovery. Built for practice.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Virtual shares track a daily published quote. They do not represent ownership, royalties, or real money.</p>
      </section>
    </div>
  );
}

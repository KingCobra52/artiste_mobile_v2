import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtistOverview } from "@/components/artist/artist-overview";
import { TradePanel } from "@/components/trade/trade-panel";
import { SampleDataNotice } from "@/components/ui/sample-data-notice";
import { StaleDataNotice } from "@/components/ui/states";
import { getArtist, getPosition, getQuote } from "@/lib/placeholder-data";

export async function generateMetadata({ params }: { params: Promise<{ artistId: string }> }): Promise<Metadata> {
  const artist = getArtist((await params).artistId);
  return { title: artist?.name ?? "Artist not found" };
}

export default async function ArtistPage({ params }: { params: Promise<{ artistId: string }> }) {
  const { artistId } = await params;
  const artist = getArtist(artistId);
  const quote = getQuote(artistId);
  if (!artist || !quote) notFound();

  return (
    <div className="space-y-5">
      <Link href="/market" className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-400 hover:text-white">← Back to Market</Link>
      <ArtistOverview artist={artist} quote={quote} />
      <SampleDataNotice />
      {quote.status !== "fresh" && <StaleDataNotice date={quote.asOf} />}
      <section className="rounded-2xl border border-white/8 bg-slate-900 p-5">
        <h2 className="font-semibold text-white">How this works</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">Virtual shares track a daily published quote. They do not represent ownership, royalties, or real money.</p>
      </section>
      <TradePanel artist={artist} currentQuote={quote} availablePosition={getPosition(artistId)} />
    </div>
  );
}

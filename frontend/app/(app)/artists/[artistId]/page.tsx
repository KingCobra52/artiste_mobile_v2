import { Suspense } from "react";
import { RetryButton } from "@/components/ui/retry-button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HistorySection } from "@/components/ui/history-section";
import { ArtistOverview } from "@/components/artist/artist-overview";
import { TradePanel } from "@/components/trade/trade-panel";
import { ErrorState } from "@/components/ui/states";
import { apiRequest, ApiError, displayApiError } from "@/lib/api";
import type { Artist, MarketQuote, Portfolio } from "@/types";
export const metadata = { title: "Artist" };
async function ArtistTrading({
  artist,
  quote,
}: {
  artist: Artist;
  quote: MarketQuote;
}) {
  let portfolio: Portfolio | null = null;
  try {
    portfolio = await apiRequest<Portfolio>("/api/v1/portfolio");
  } catch {
    /* Preserve artist research if the portfolio is unavailable. */
  }
  if (!portfolio)
    return (
      <section className="rounded-2xl border border-white/15 p-5">
        <h2 className="font-semibold">Trading controls unavailable</h2>
        <p className="mt-3 text-sm text-slate-400">
          Your portfolio could not be loaded. You can still research this
          artist. Use the button below to retry.
        </p>
        <RetryButton />
      </section>
    );
  return (
    <TradePanel
      artist={artist}
      currentQuote={quote}
      availablePosition={
        portfolio.holdings.find((holding) => holding.artist.id === artist.id)
          ?.quantity ?? 0
      }
      cashCents={portfolio.summary.cashCents}
    />
  );
}
export default async function ArtistPage({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  const { artistId } = await params;
  if (!/^\d+$/.test(artistId)) notFound();
  let artist: Artist;
  let quote: MarketQuote;
  try {
    [artist, quote] = await Promise.all([
      apiRequest<Artist>(`/api/v1/artists/${artistId}`),
      apiRequest<MarketQuote>(`/api/v1/market/${artistId}`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <ErrorState title="Artist unavailable" message={displayApiError(error)} />
    );
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        className="touch inline-flex items-center text-sm text-sky-200"
        href="/market"
      >
        ← Back to Market
      </Link>
      <ArtistOverview artist={artist} quote={quote} />
      {artist.active === false && (
        <p
          role="status"
          className="rounded-xl bg-amber-300/10 p-4 text-sm text-amber-100"
        >
          This artist is outside the supported catalog. Existing holdings remain
          visible and use purchase-cost valuation.
        </p>
      )}
      <section className="rounded-3xl border border-white/10 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold">Explore the music</h2>
        <p className="mt-3 leading-7 text-slate-300">
          {artist.musicContext || "Music context is being reviewed."}
        </p>
        {(artist.notableReleases?.length ?? 0) > 0 && (
          <>
            <h3 className="mt-5 text-sm font-semibold">
              Start with these releases
            </h3>
            <ul className="mt-2 list-inside list-disc space-y-2 text-sm text-slate-300">
              {artist.notableReleases!.map((release) => (
                <li key={release}>{release}</li>
              ))}
            </ul>
          </>
        )}
        {artist.listeningUrl?.startsWith("https://") && (
          <a
            className="touch action-primary mt-5 inline-flex items-center rounded-xl px-5"
            href={artist.listeningUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Listen on the official channel ↗
          </a>
        )}
        {artist.contextSourceUrl?.startsWith("https://") && (
          <a
            className="touch mt-3 flex items-center text-xs text-slate-400 underline"
            href={artist.contextSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Biography and context source ↗
          </a>
        )}
      </section>
      <HistorySection
        title="Price history"
        path={`/api/v1/artists/${artistId}/history`}
      />
      <Suspense
        fallback={
          <p role="status" className="p-5 text-sm text-slate-400">
            Loading trading controls…
          </p>
        }
      >
        <ArtistTrading artist={artist} quote={quote} />
      </Suspense>
      <details className="rounded-2xl border border-white/10 p-5">
        <summary className="touch cursor-pointer font-semibold">
          How this virtual price works
        </summary>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          Audience growth establishes an external anchor. Net completed buying
          and selling adjust prices by at most 20% around that anchor. The
          estimated order follows the whole curve and includes a 0.10% fee. Only
          fresh published quotes can be traded. Virtual shares provide no
          ownership, royalties or real money.
        </p>
        <p className="mt-3 text-xs text-slate-400">
          Methodology: {quote.pricingVersion}. Source growth is an average per
          elapsed day, not a guaranteed 24-hour price return.
        </p>
      </details>
    </div>
  );
}

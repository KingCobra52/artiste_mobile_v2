import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
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
      <section className="panel">
        <h2 className="font-semibold">Trading controls unavailable</h2>
        <p className="body-copy mt-3 text-sm">
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
    <div>
      <Link href="/market" className="text-link mb-5 text-sm">
        <Icon name="back" />
        Back to Market
      </Link>
      <div className="artist-page">
        <div className="artist-research">
          <ArtistOverview artist={artist} quote={quote} />
          {artist.active === false && (
            <p role="status" className="notice">
              <Icon name="clock" />
              This artist is outside the supported catalog. Existing holdings
              remain visible and use purchase-cost valuation.
            </p>
          )}
          <section className="panel">
            <p className="eyebrow mb-3">Behind the numbers</p>
            <h2 className="section-title">Explore the music</h2>
            <p className="body-copy mt-4">
              {artist.musicContext || "Music context is being reviewed."}
            </p>
            {Boolean(artist.notableReleases?.length) && (
              <>
                <h3 className="small-copy mt-6">Start with these releases</h3>
                <ul className="release-list">
                  {artist.notableReleases!.map((release) => (
                    <li key={release}>
                      <Icon name="record" />
                      {release}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {artist.listeningUrl?.startsWith("https://") && (
              <a
                className="action-secondary w-full sm:w-auto"
                href={artist.listeningUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="record" />
                Listen on the official channel ↗
              </a>
            )}
            {artist.contextSourceUrl?.startsWith("https://") && (
              <a
                className="text-link mt-3 text-sm"
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
        </div>
        <aside className="artist-trading">
          <Suspense
            fallback={
              <div className="panel" role="status">
                <p className="eyebrow">Paper trading</p>
                <p className="body-copy mt-3">
                  Loading your cash and holdings…
                </p>
              </div>
            }
          >
            <ArtistTrading artist={artist} quote={quote} />
          </Suspense>
          <details className="disclosure">
            <summary>How this virtual price works</summary>
            <p>
              Virtual shares are paper positions, not ownership or royalties.
              Audience signals establish the current price anchor. Completed
              buys and sells move a simulated, elastic market curve by at most
              20% around that anchor; this is not a fixed supply of artist
              shares. The estimate follows the whole curve and includes a
              0.10% fee. Only fresh published quotes can be traded.
            </p>
            <p>
              Source growth is measured per elapsed day, not a guaranteed
              24-hour price return. A separate performance-index model is being
              evaluated in shadow mode and does not determine this quote.
            </p>
            <p className="small-copy">
              Pricing method: {quote.pricingVersion ?? "Unavailable"}
            </p>
          </details>
        </aside>
      </div>
    </div>
  );
}

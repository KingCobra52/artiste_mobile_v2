import type { Metadata } from "next";
import Link from "next/link";
import { MarketList } from "@/components/market/market-list";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Icon } from "@/components/ui/icon";
import { apiRequest, displayApiError } from "@/lib/api";
import type { Artist, MarketQuote } from "@/types";
export const metadata: Metadata = { title: "Market" };
export default async function MarketPage() {
  let artists: Artist[] = [],
    quotes: MarketQuote[] = [];
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
      <header className="page-intro">
        <div>
          <p className="eyebrow">The artist market</p>
          <h1 className="display">Find your next artist</h1>
        </div>
        <div className="intro-context">
          <p className="body-copy">
            Start with the music. Get to know the artists, read their audience
            signals, and put your instincts into practice with virtual shares.
          </p>
          <Link href="/onboarding?replay=1" className="text-link text-sm">
            Understand the market <Icon name="arrow" />
          </Link>
        </div>
      </header>
      {error ? (
        <ErrorState title="Market unavailable" message={error} />
      ) : artists.length ? (
        <MarketList artists={artists} quotes={quotes} />
      ) : (
        <EmptyState title="No artists to explore right now">
          Artists appear here when their context and quotes are ready. Check
          back after the next data update.
        </EmptyState>
      )}
      <p className="small-copy mt-6">
        Audience growth is measured per elapsed day, not a 24-hour share-price
        return. All prices and trades use virtual cash.
      </p>
    </div>
  );
}

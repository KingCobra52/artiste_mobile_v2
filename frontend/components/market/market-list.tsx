"use client";
import Link from "next/link";
import { useHydrated } from "@/lib/use-hydrated";
import { useMemo, useState } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import { ArtistSleeve } from "@/components/artist/artist-sleeve";
import { QuoteStatus } from "@/components/ui/quote-status";
import { Icon } from "@/components/ui/icon";
import type { Artist, MarketQuote } from "@/types";
export function MarketList({
  artists,
  quotes,
}: {
  artists: Artist[];
  quotes: MarketQuote[];
}) {
  const hydrated = useHydrated();
  const [search, setSearch] = useState("");
  const normalized = search.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      artists.filter(
        (artist) =>
          normalized
            ? artist.name.toLocaleLowerCase().includes(normalized) ||
              artist.symbol.toLocaleLowerCase().includes(normalized)
            : quotes.some(
                (quote) =>
                  quote.artistId === artist.id &&
                  quote.priceCents != null &&
                  quote.quoteVersion != null &&
                  (quote.status === "fresh" || quote.status === "stale"),
              ),
      ),
    [artists, normalized, quotes],
  );
  return (
    <div>
      <div className="market-toolbar">
        <div className="search-field">
          <label htmlFor="artist-search" className="sr-only">
            Search artists by name or symbol
          </label>
          <Icon name="search" />
          <input
            id="artist-search"
            type="search"
            disabled={!hydrated}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find an artist or symbol"
            className="auth-input"
          />
          {search && (
            <button
              type="button"
              className="icon-button search-clear"
              aria-label="Clear artist search"
              onClick={() => setSearch("")}
            >
              <Icon name="close" />
            </button>
          )}
        </div>
        <p aria-live="polite" aria-atomic="true" className="small-copy">
          {filtered.length} {filtered.length === 1 ? "artist" : "artists"}
        </p>
      </div>
      {!filtered.length ? (
        <div className="state-panel">
          <h2>No artists found</h2>
          <p>
            Search by name or symbol to find artists, including those awaiting quotes.
          </p>
        </div>
      ) : (
        <div className="artist-grid">
          {filtered.map((artist) => {
            const quote = quotes.find((item) => item.artistId === artist.id);
            const change = quote?.changePercent;
            return (
              <Link
                key={artist.id}
                href={`/artists/${artist.id}`}
                className="artist-card"
              >
                <div className="artist-card-top">
                  <ArtistSleeve artist={artist} />
                  <div className="min-w-0">
                    <p className="eyebrow mb-2">
                      {artist.symbol} · {artist.genre}
                    </p>
                    <h2>{artist.name}</h2>
                  </div>
                </div>
                {artist.biography && (
                  <p className="artist-card-description">{artist.biography}</p>
                )}
                <div className="artist-card-quote">
                  <div>
                    <p className="small-copy mb-1">Virtual share</p>
                    <p className="data">
                      {formatMoney(quote?.priceCents ?? null)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${typeof change !== "number" ? "text-muted" : change >= 0 ? "positive" : "negative"}`}
                    >
                      {typeof change === "number"
                        ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`
                        : "Unavailable"}
                    </p>
                    <p className="small-copy">Audience / day</p>
                  </div>
                </div>
                <div className="artist-card-footer">
                  <div>
                    {quote?.quoteVersion ? (
                      <QuoteStatus status={quote.status} />
                    ) : (
                      <span className="quote-status status-unavailable">
                        Awaiting published quote
                      </span>
                    )}
                    <p className="small-copy mt-1">
                      Data {formatDate(quote?.asOf ?? null)}
                    </p>
                  </div>
                  <Icon name="arrow" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

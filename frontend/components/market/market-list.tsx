"use client";

import Link from "next/link";
import { useHydrated } from "@/lib/use-hydrated";
import { useMemo, useState } from "react";
import { formatDate, formatMoney } from "@/lib/format";
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
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredArtists = useMemo(() => {
    if (!normalizedSearch) return artists;
    return artists.filter(
      (artist) =>
        artist.name.toLocaleLowerCase().includes(normalizedSearch) ||
        artist.symbol.toLocaleLowerCase().includes(normalizedSearch),
    );
  }, [artists, normalizedSearch]);

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <label htmlFor="artist-search" className="sr-only">
            Search artists by name or symbol
          </label>
          <input
            id="artist-search"
            type="search"
            disabled={!hydrated}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search artists or symbols"
            className="min-h-12 w-full rounded-xl border border-white/10 bg-slate-900 px-4 pr-12 text-white placeholder:text-slate-500 focus:border-lime-300/60 focus:outline-none focus:ring-2 focus:ring-lime-300/30"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear artist search"
              className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-lime-300"
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
        <p
          className="text-sm text-slate-400"
          aria-live="polite"
          aria-atomic="true"
        >
          {filteredArtists.length}{" "}
          {filteredArtists.length === 1 ? "artist" : "artists"}
        </p>
      </div>
      {filteredArtists.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-slate-900 px-5 py-10 text-center">
          <p className="font-semibold text-white">No artists found</p>
          <p className="mt-1 text-sm text-slate-400">
            Try another name or symbol in the supported catalog.
          </p>
        </div>
      ) : (
        <div className="market-rows">
          {filteredArtists.map((artist) => {
            const quote = quotes.find((item) => item.artistId === artist.id);
            const change = quote?.changePercent;
            return (
              <Link
                key={artist.id}
                href={`/artists/${artist.id}`}
                className="market-row flex min-h-24 items-center gap-4 px-4 py-5 sm:px-6 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
              >
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl artist-monogram font-semibold">
                  {artist.symbol.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="truncate font-semibold text-white">
                      {artist.name}
                    </h2>
                    <p className="font-semibold tabular-nums text-white">
                      {formatMoney(quote?.priceCents ?? null)}
                    </p>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                    <p className="truncate text-slate-400">
                      {artist.symbol} · {artist.genre}
                    </p>
                    {typeof change === "number" ? (
                      <p
                        className={`font-medium tabular-nums ${change >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                      >
                        {change >= 0 ? "+" : ""}
                        {change.toFixed(1)}%
                      </p>
                    ) : (
                      <p className="text-slate-500">
                        {quote?.status === "unavailable"
                          ? "No quote"
                          : "No change"}
                      </p>
                    )}
                  </div>
                  <p
                    className={`mt-2 text-xs ${quote?.status !== "fresh" ? "text-amber-300" : "text-slate-500"}`}
                  >
                    {quote?.status === "stale"
                      ? "Stale · "
                      : quote?.status === "unavailable"
                        ? "Unavailable · "
                        : ""}
                    {formatDate(quote?.asOf ?? null)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

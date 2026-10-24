import { formatTimestamp, formatMoney } from "@/lib/format";
import type { Artist, MarketQuote } from "@/types";

export function ArtistOverview({
  artist,
  quote,
}: {
  artist: Artist;
  quote: MarketQuote;
}) {
  return (
    <section className="artist-hero overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl artist-monogram text-xl font-semibold">
            {artist.symbol.slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold text-lime-200">
              {artist.symbol} · {artist.genre}
            </p>
            <h1 className="artist-title mt-1 text-white">{artist.name}</h1>
          </div>
        </div>
        <p className="mt-5 leading-7 text-slate-300">
          {artist.biography || "This artist’s biography is awaiting review."}
        </p>
        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Latest quote</p>
            <p className="money-display mt-1 text-white">
              {formatMoney(quote.priceCents)}
            </p>
          </div>
          {quote.changePercent !== null && (
            <p
              className={`pb-1 font-semibold ${quote.changePercent >= 0 ? "text-emerald-300" : "text-rose-300"}`}
            >
              {quote.changePercent >= 0 ? "+" : ""}
              {quote.changePercent.toFixed(1)}%
            </p>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Source growth per elapsed day · Trading adjustment{" "}
          {quote.demandPercent?.toFixed(2) ?? "0.00"}%
        </p>
        <p className="mt-3 text-sm text-slate-400">
          {quote.status} · Sources as of {formatTimestamp(quote.asOf)} · Price
          published {formatTimestamp(quote.pricedAt)}
        </p>
      </div>
    </section>
  );
}

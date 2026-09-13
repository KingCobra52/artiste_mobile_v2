import { formatDate, formatMoney } from "@/lib/format";
import type { Artist, MarketQuote } from "@/types";

export function ArtistOverview({ artist, quote }: { artist: Artist; quote: MarketQuote }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/8 bg-slate-900">
      <div className="bg-[radial-gradient(circle_at_top_right,rgba(190,242,100,0.22),transparent_50%)] p-6">
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl bg-lime-300 text-xl font-black text-slate-950">
            {artist.symbol.slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold text-lime-200">{artist.symbol} · {artist.genre}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">{artist.name}</h1>
          </div>
        </div>
        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Latest quote</p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-white">{formatMoney(quote.priceCents)}</p>
          </div>
          {quote.changePercent !== null && (
            <p className={`pb-1 font-semibold ${quote.changePercent >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(1)}%
            </p>
          )}
        </div>
        <p className="mt-3 text-sm text-slate-400">Quote date: {formatDate(quote.asOf)}</p>
      </div>
    </section>
  );
}

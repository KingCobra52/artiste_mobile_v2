import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/format";
import type { Artist, MarketQuote } from "@/types";

export function MarketList({ artists, quotes }: { artists: Artist[]; quotes: MarketQuote[] }) {
  return (
    <div className="space-y-3">
      {artists.map((artist) => {
        const quote = quotes.find((item) => item.artistId === artist.id);
        const change = quote?.changePercent;
        return (
          <Link
            key={artist.id}
            href={`/artists/${artist.id}`}
            className="flex min-h-24 items-center gap-4 rounded-2xl border border-white/8 bg-slate-900 p-4 transition hover:border-lime-300/30 hover:bg-slate-800/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
          >
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lime-300 to-emerald-500 font-black text-slate-950">
              {artist.symbol.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="truncate font-semibold text-white">{artist.name}</h2>
                <p className="font-semibold tabular-nums text-white">{formatMoney(quote?.priceCents ?? null)}</p>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                <p className="truncate text-slate-400">{artist.symbol} · {artist.genre}</p>
                {typeof change === "number" ? (
                  <p className={`font-medium tabular-nums ${change >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {change >= 0 ? "+" : ""}{change.toFixed(1)}%
                  </p>
                ) : <p className="text-slate-500">No change</p>}
              </div>
              <p className={`mt-2 text-xs ${quote?.status === "stale" ? "text-amber-300" : "text-slate-500"}`}>
                {quote?.status === "stale" ? "Stale · " : ""}{formatDate(quote?.asOf ?? null)}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

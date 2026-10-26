import { formatTimestamp, formatMoney } from "@/lib/format";
import { ArtistSleeve } from "./artist-sleeve";
import { QuoteStatus } from "@/components/ui/quote-status";
import type { Artist, MarketQuote } from "@/types";
export function ArtistOverview({
  artist,
  quote,
}: {
  artist: Artist;
  quote: MarketQuote;
}) {
  const growth = quote.changePercent;
  return (
    <section className="panel artist-hero">
      <div className="artist-identity">
        <ArtistSleeve artist={artist} large />
        <div className="min-w-0">
          <p className="eyebrow">
            {artist.symbol} · {artist.genre}
          </p>
          <h1 className="artist-title">{artist.name}</h1>
          <p className="small-copy">Music discovery / Virtual shares</p>
        </div>
      </div>
      <p className="body-copy">
        {artist.biography || "This artist’s biography is awaiting review."}
      </p>
      <div className="artist-quote mt-6">
        <div className="quote-heading">
          <p className="small-copy">
            {quote.quoteVersion ? "Latest quote" : "Audience price"} · per
            virtual share
          </p>
          {quote.quoteVersion ? (
            <QuoteStatus status={quote.status} />
          ) : (
            <span className="quote-status status-unavailable">
              Awaiting published quote
            </span>
          )}
        </div>
        <p className="money-display mt-3">{formatMoney(quote.priceCents)}</p>
        <dl className="quote-measures">
          <div>
            <dt className="small-copy">Audience growth / day</dt>
            <dd
              className={
                growth === null
                  ? "text-muted"
                  : growth >= 0
                    ? "positive"
                    : "negative"
              }
            >
              {growth === null
                ? "Unavailable"
                : `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`}
            </dd>
          </div>
          <div>
            <dt className="small-copy">Platform adjustment</dt>
            <dd>
              {quote.demandPercent === undefined
                ? "Unavailable"
                : `${quote.demandPercent >= 0 ? "+" : ""}${quote.demandPercent.toFixed(2)}%`}
            </dd>
          </div>
        </dl>
        <div className="small-copy space-y-1">
          <p>
            {quote.pricedAt
              ? `Quote published ${formatTimestamp(quote.pricedAt)}`
              : "A tradable quote has not been published yet."}
          </p>
          <p>Audience data {formatTimestamp(quote.asOf)}</p>
        </div>
      </div>
    </section>
  );
}

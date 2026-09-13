export type ISODateString = string;

export interface Artist {
  id: string;
  name: string;
  symbol: string;
  genre: string;
}

export interface MarketQuote {
  artistId: string;
  priceCents: number | null;
  changePercent: number | null;
  asOf: ISODateString | null;
  status: "fresh" | "stale" | "unavailable";
}

export interface TradeDraft {
  artistId: string;
  side: "buy" | "sell";
  quantity: number;
  requestId: string;
}

export type TradeResult =
  | { ok: true; code: "accepted"; message: string }
  | {
      ok: false;
      code:
        | "not_connected"
        | "unauthenticated"
        | "configuration_error"
        | "validation_error";
      message: string;
      fieldErrors?: Partial<Record<keyof TradeDraft, string>>;
    };

export interface Holding {
  artist: Artist;
  quantity: number;
  averageCostCents: number;
  currentValueCents: number | null;
  firstPurchasedAt: ISODateString;
}

export interface PortfolioSummary {
  cashCents: number;
  holdingsValueCents: number;
  totalValueCents: number;
  gainLossCents: number;
  asOf: ISODateString;
  status: "fresh" | "stale";
}

export interface PortfolioSeriesPoint {
  date: ISODateString;
  valueCents: number;
}

export interface PortfolioAllocation {
  artistId: string;
  label: string;
  valueCents: number;
  percentage: number;
}

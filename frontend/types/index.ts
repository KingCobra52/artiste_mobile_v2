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
  | {
      ok: true;
      code: "accepted";
      message: string;
      tradeId: number;
      executionPriceCents: number;
      totalCents: number;
      cashCents: number;
      idempotent: boolean;
    }
  | { ok: false; code: string; message: string };

export interface Holding {
  artist: Artist;
  quantity: number;
  averageCostCents: number;
  currentValueCents: number | null;
  firstPurchasedAt: ISODateString;
}

export interface PortfolioSummary {
  cashCents: number;
  holdingsValueCents: number | null;
  totalValueCents: number | null;
  gainLossCents: number | null;
  asOf: ISODateString;
  status: "fresh" | "stale";
}

export interface TradeHistoryItem {
  id: number;
  artist: Artist;
  side: "buy" | "sell";
  quantity: number;
  executionPriceCents: number;
  totalCents: number;
  executedAt: ISODateString;
}

export interface Portfolio {
  summary: PortfolioSummary;
  holdings: Holding[];
  trades: TradeHistoryItem[];
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

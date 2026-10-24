export type ISODateString = string;

export interface Artist {
  id: string;
  name: string;
  symbol: string;
  genre: string;
  biography?: string;
  musicContext?: string;
  notableReleases?: string[];
  listeningUrl?: string;
  contextSourceUrl?: string;
  imageUrl?: string | null;
  active?: boolean;
}

export interface MarketQuote {
  artistId: string;
  priceCents: number | null;
  changePercent: number | null;
  asOf: ISODateString | null;
  status: "fresh" | "stale" | "unavailable";
  quoteVersion?: string | null;
  pricedAt?: string | null;
  pricingVersion?: string;
  demandPercent?: number;
  externalAnchorCents?: number | null;
  sources?: Record<
    string,
    { asOf?: string; elapsedDays?: number; matchedTracks?: number }
  >;
}

export interface TradeDraft {
  artistId: string;
  side: "buy" | "sell";
  quantity: number;
  requestId: string;
  quoteVersion?: string;
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
  lastPurchasedAt?: ISODateString | null;
  costBasisCents?: number;
  costBasisMethod?: string;
  currentPriceCents?: number | null;
  quoteAsOf?: ISODateString | null;
  dataSourceAsOf?: ISODateString | null;
  valuationBasis?: "quote" | "stale_quote" | "purchase_cost";
  purchases?: {
    quantity: number;
    priceCents: number;
    totalCents: number;
    feeCents: number;
    date: string;
  }[];
}

export interface PortfolioSummary {
  cashCents: number;
  holdingsValueCents: number | null;
  totalValueCents: number | null;
  gainLossCents: number | null;
  asOf: ISODateString | null;
  calculatedAt?: ISODateString;
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

export interface TradePreview {
  quoteVersion: string;
  grossCents: number;
  feeCents: number;
  totalCents: number;
  executionPriceCents: number;
  priceAfterCents: number;
  priceImpactPercent: number;
  shadow: boolean;
  asOf: string;
  pricingVersion: string;
}

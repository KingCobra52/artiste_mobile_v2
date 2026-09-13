import type {
  Artist,
  Holding,
  MarketQuote,
  PortfolioAllocation,
  PortfolioSeriesPoint,
  PortfolioSummary,
} from "@/types";

export const artists: Artist[] = [
  { id: "sza", name: "SZA", symbol: "SZA", genre: "R&B" },
  { id: "bad-bunny", name: "Bad Bunny", symbol: "BBNY", genre: "Latin" },
  { id: "tyler-the-creator", name: "Tyler, The Creator", symbol: "TYLR", genre: "Hip-hop" },
  { id: "billie-eilish", name: "Billie Eilish", symbol: "BILL", genre: "Pop" },
];

export const quotes: MarketQuote[] = [
  { artistId: "sza", priceCents: 4280, changePercent: 2.4, asOf: "2026-09-11", status: "fresh" },
  { artistId: "bad-bunny", priceCents: 6175, changePercent: -0.8, asOf: "2026-09-11", status: "fresh" },
  { artistId: "tyler-the-creator", priceCents: 3540, changePercent: 1.1, asOf: "2026-09-08", status: "stale" },
  { artistId: "billie-eilish", priceCents: null, changePercent: null, asOf: null, status: "unavailable" },
];

export const holdings: Holding[] = [
  {
    artist: artists[0],
    quantity: 12,
    averageCostCents: 3975,
    currentValueCents: 51360,
    firstPurchasedAt: "2026-09-02",
  },
  {
    artist: artists[1],
    quantity: 5,
    averageCostCents: 6290,
    currentValueCents: 30875,
    firstPurchasedAt: "2026-09-05",
  },
];

export const portfolioSummary: PortfolioSummary = {
  cashCents: 624500,
  holdingsValueCents: 82235,
  totalValueCents: 706735,
  gainLossCents: 305,
  asOf: "2026-09-11",
  status: "fresh",
};

export const portfolioSeries: PortfolioSeriesPoint[] = [
  { date: "2026-09-05", valueCents: 700000 },
  { date: "2026-09-07", valueCents: 701420 },
  { date: "2026-09-09", valueCents: 704180 },
  { date: "2026-09-11", valueCents: 706735 },
];

export const portfolioAllocation: PortfolioAllocation[] = [
  { artistId: "sza", label: "SZA", valueCents: 51360, percentage: 62.5 },
  { artistId: "bad-bunny", label: "Bad Bunny", valueCents: 30875, percentage: 37.5 },
];

export function getArtist(artistId: string): Artist | undefined {
  return artists.find((artist) => artist.id === artistId);
}

export function getQuote(artistId: string): MarketQuote | undefined {
  return quotes.find((quote) => quote.artistId === artistId);
}

export function getPosition(artistId: string): number {
  return holdings.find((holding) => holding.artist.id === artistId)?.quantity ?? 0;
}

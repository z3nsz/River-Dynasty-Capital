export type SleeveSlug = string;

export interface Sleeve {
  id: string;
  slug: SleeveSlug;
  display_name: string;
  inception_date: string; // ISO date
  sp_inception_price: number;
  combined_weight: number;
  sort_order: number;
}

export type PositionStatus = "open" | "closed";

export interface Position {
  id: string;
  sleeve_id: string;
  ticker: string;
  company: string;
  entry_price: number;
  entry_date: string;
  weight_pct: number;
  current_price: number | null;
  thesis: string;
  status: PositionStatus;
  exit_price: number | null;
  exit_date: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Snapshot {
  id: string;
  sleeve_id: string | null;
  date: string;
  portfolio_index: number;
  sp_index: number;
}

export interface RecentPoint {
  t: number; // epoch ms
  p: number; // price
}

export interface Quote {
  price: number;
  prevClose: number;
  changePct: number;
  recent: RecentPoint[];
  asOf: string | null;
}

export type QuoteMap = Record<string, Quote>;

export interface MarketStatus {
  status: "open" | "closed";
  /** Human label, e.g. "Open · closes 16:00 ET" or "Closed · opens Mon 09:30 ET" */
  label: string;
  /** Timezone abbreviation we quote hours in. */
  tz: "ET";
  /** Current wall-clock time in ET, "HH:MM:SS". */
  nowET: string;
  /** ISO timestamp of the next open/close transition, if known. */
  nextChangeAt: string | null;
  /** Why it's closed, when closed: "weekend" | "holiday" | "after-hours" | null */
  reason: "weekend" | "holiday" | "after-hours" | "pre-market" | null;
}

export interface PricesResponse {
  asOf: string | null;
  fetchedAt: string;
  source: "finnhub" | "manual" | "cache";
  market: MarketStatus;
  quotes: QuoteMap;
}

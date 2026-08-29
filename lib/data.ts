/**
 * Loads portfolio data from Supabase and shapes it for the UI. Server-side.
 * Single fund ("Seine's Fund"); never emits money.
 */

import { getPublicClient } from "@/lib/supabase/public";
import { BENCHMARK_SYMBOL } from "@/lib/config";
import type { Sleeve, Position, Snapshot, QuoteMap } from "@/lib/types";
import type {
  HoldingInput,
  ClosedInput,
  SleeveMeta,
} from "@/lib/sleeveMetrics";

export interface PortfolioData {
  configured: boolean;
  sleeves: Sleeve[];
  positions: Position[];
  snapshots: Snapshot[];
}

export async function loadPortfolio(): Promise<PortfolioData> {
  const sb = getPublicClient();
  if (!sb) {
    return { configured: false, sleeves: [], positions: [], snapshots: [] };
  }

  const [sleevesRes, positionsRes, snapshotsRes] = await Promise.all([
    sb.from("sleeves").select("*").order("sort_order", { ascending: true }),
    sb.from("positions").select("*").order("weight_pct", { ascending: false }),
    sb.from("snapshots").select("*").order("date", { ascending: true }),
  ]);

  if (sleevesRes.error || positionsRes.error || snapshotsRes.error) {
    throw new Error(
      sleevesRes.error?.message ||
        positionsRes.error?.message ||
        snapshotsRes.error?.message,
    );
  }

  return {
    configured: true,
    sleeves: (sleevesRes.data ?? []) as Sleeve[],
    positions: (positionsRes.data ?? []) as Position[],
    snapshots: (snapshotsRes.data ?? []) as Snapshot[],
  };
}

export interface SelectedSleeve {
  meta: SleeveMeta;
  holdings: HoldingInput[];
  closed: ClosedInput[];
  snapshots: Snapshot[];
}

/** The one fund. Returns null only if no sleeve rows exist. */
export function primarySleeve(data: PortfolioData): Sleeve | null {
  return (
    [...data.sleeves].sort((a, b) => a.sort_order - b.sort_order)[0] ?? null
  );
}

export function selectFund(data: PortfolioData): SelectedSleeve | null {
  const sleeve = primarySleeve(data);
  if (!sleeve) return null;

  const meta: SleeveMeta = {
    slug: sleeve.slug,
    displayName: sleeve.display_name,
    inceptionDate: sleeve.inception_date,
    spInceptionPrice: sleeve.sp_inception_price,
  };

  const mine = data.positions.filter((p) => p.sleeve_id === sleeve.id);

  const holdings: HoldingInput[] = mine
    .filter((p) => p.status === "open")
    .map((p) => ({
      id: p.id,
      ticker: p.ticker,
      company: p.company,
      entryPrice: p.entry_price,
      entryDate: p.entry_date,
      weightPct: p.weight_pct,
      thesis: p.thesis,
      sleeveName: sleeve.display_name,
      manualPrice: p.current_price,
    }));

  const closed: ClosedInput[] = mine
    .filter((p) => p.status === "closed")
    .map((p) => ({
      id: p.id,
      ticker: p.ticker,
      company: p.company,
      entryPrice: p.entry_price,
      entryDate: p.entry_date,
      exitPrice: p.exit_price,
      exitDate: p.exit_date,
      weightPct: p.weight_pct,
      thesis: p.thesis,
      sleeveName: sleeve.display_name,
    }));

  const snapshots = data.snapshots.filter((s) => s.sleeve_id === sleeve.id);

  return { meta, holdings, closed, snapshots };
}

export function benchmarkFromQuotes(quotes: QuoteMap): number | null {
  const q = quotes[BENCHMARK_SYMBOL];
  return q && Number.isFinite(q.price) ? q.price : null;
}

interface PriceCacheRow {
  symbol: string;
  price: number | null;
  prev_close: number | null;
  as_of: string | null;
  recent: QuoteMap[string]["recent"] | null;
}

/**
 * Read the cached quotes with the public (anon) client — used for the initial
 * server render of the public page. No Finnhub call, no service role needed.
 */
export async function loadQuotes(): Promise<{ quotes: QuoteMap; asOf: string | null }> {
  const sb = getPublicClient();
  if (!sb) return { quotes: {}, asOf: null };

  const { data, error } = await sb
    .from("price_cache")
    .select("symbol, price, prev_close, as_of, recent");
  if (error || !data) return { quotes: {}, asOf: null };

  const quotes: QuoteMap = {};
  let asOf: string | null = null;
  for (const row of data as PriceCacheRow[]) {
    if (row.price == null) continue;
    const prev = row.prev_close ?? row.price;
    quotes[row.symbol] = {
      price: row.price,
      prevClose: prev,
      changePct: prev > 0 ? ((row.price - prev) / prev) * 100 : 0,
      recent: Array.isArray(row.recent) ? row.recent : [],
      asOf: row.as_of,
    };
    if (row.as_of && (!asOf || row.as_of > asOf)) asOf = row.as_of;
  }
  return { quotes, asOf };
}

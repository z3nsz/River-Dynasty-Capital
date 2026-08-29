/**
 * Loads portfolio data from Supabase and shapes it for the UI. Server-side.
 * Builds the synthetic "Combined" sleeve. Never emits money.
 */

import { getPublicClient } from "@/lib/supabase/public";
import { COMBINED_SLUG, BENCHMARK_SYMBOL } from "@/lib/config";
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

export interface SleeveOption {
  slug: string;
  displayName: string;
  isCombined: boolean;
}

export function sleeveOptions(sleeves: Sleeve[]): SleeveOption[] {
  const real = [...sleeves]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({
      slug: s.slug,
      displayName: s.display_name,
      isCombined: false,
    }));
  return [
    { slug: COMBINED_SLUG, displayName: "Combined", isCombined: true },
    ...real,
  ];
}

function earliest(dates: string[]): string {
  return dates.slice().sort()[0];
}

export function resolveMeta(
  slug: string,
  sleeves: Sleeve[],
): SleeveMeta | null {
  if (slug === COMBINED_SLUG) {
    if (sleeves.length === 0) return null;
    const inception = earliest(sleeves.map((s) => s.inception_date));
    const earlierSleeve =
      sleeves.find((s) => s.inception_date === inception) ?? sleeves[0];
    return {
      slug: COMBINED_SLUG,
      displayName: "Combined",
      inceptionDate: inception,
      spInceptionPrice: earlierSleeve.sp_inception_price,
      isCombined: true,
    };
  }
  const s = sleeves.find((x) => x.slug === slug);
  if (!s) return null;
  return {
    slug: s.slug,
    displayName: s.display_name,
    inceptionDate: s.inception_date,
    spInceptionPrice: s.sp_inception_price,
    isCombined: false,
  };
}

/** Normalised combined weight for a sleeve (defaults to equal split). */
function combinedWeights(sleeves: Sleeve[]): Map<string, number> {
  const total = sleeves.reduce((s, x) => s + (x.combined_weight || 0), 0);
  const m = new Map<string, number>();
  for (const s of sleeves) {
    m.set(s.id, total > 0 ? (s.combined_weight || 0) / total : 1 / sleeves.length);
  }
  return m;
}

export interface SelectedSleeve {
  meta: SleeveMeta;
  holdings: HoldingInput[];
  closed: ClosedInput[];
  snapshots: Snapshot[];
}

export function selectSleeve(
  slug: string,
  data: PortfolioData,
): SelectedSleeve | null {
  const meta = resolveMeta(slug, data.sleeves);
  if (!meta) return null;

  const isCombined = slug === COMBINED_SLUG;
  const cw = combinedWeights(data.sleeves);
  const bySleeveId = new Map(data.sleeves.map((s) => [s.id, s]));

  const relevant = isCombined
    ? data.positions
    : data.positions.filter((p) => {
        const s = bySleeveId.get(p.sleeve_id);
        return s?.slug === slug;
      });

  const holdings: HoldingInput[] = relevant
    .filter((p) => p.status === "open")
    .map((p) => {
      const s = bySleeveId.get(p.sleeve_id)!;
      const scale = isCombined ? cw.get(p.sleeve_id) ?? 1 : 1;
      return {
        id: p.id,
        ticker: p.ticker,
        company: p.company,
        entryPrice: p.entry_price,
        entryDate: p.entry_date,
        weightPct: p.weight_pct * scale,
        thesis: p.thesis,
        sleeveSlug: s.slug,
        sleeveName: s.display_name,
        manualPrice: p.current_price,
      };
    });

  const closed: ClosedInput[] = relevant
    .filter((p) => p.status === "closed")
    .map((p) => {
      const s = bySleeveId.get(p.sleeve_id)!;
      return {
        id: p.id,
        ticker: p.ticker,
        company: p.company,
        entryPrice: p.entry_price,
        entryDate: p.entry_date,
        exitPrice: p.exit_price,
        exitDate: p.exit_date,
        weightPct: p.weight_pct,
        thesis: p.thesis,
        sleeveSlug: s.slug,
        sleeveName: s.display_name,
      };
    });

  const snapshots = isCombined
    ? data.snapshots.filter((s) => s.sleeve_id === null)
    : data.snapshots.filter((s) => {
        const sl = data.sleeves.find((x) => x.id === s.sleeve_id);
        return sl?.slug === slug;
      });

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

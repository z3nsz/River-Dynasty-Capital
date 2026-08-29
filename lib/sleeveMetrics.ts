/**
 * Isomorphic derived-metrics computation. Runs on the server for the initial
 * render and in the browser on every live-price poll, from the SAME inputs and
 * the SAME quote map, so the numbers never disagree. Money-free: ratios and
 * index values only.
 */

import {
  holdingReturn,
  sleeveReturn,
  cagr,
  daysBetween,
  benchmarkReturn,
  excessPoints,
  toIndex,
  realizedReturn,
} from "./returns";
import { BENCHMARK_SYMBOL } from "./config";
import type { QuoteMap, RecentPoint } from "./types";

export interface HoldingInput {
  id: string;
  ticker: string;
  company: string;
  entryPrice: number;
  entryDate: string;
  /** For Combined this is weight_pct scaled by the sleeve's combined weight. */
  weightPct: number;
  thesis: string;
  sleeveSlug: string;
  sleeveName: string;
  /** Manual fallback price from the positions table; used when no live quote. */
  manualPrice: number | null;
}

export interface ClosedInput {
  id: string;
  ticker: string;
  company: string;
  entryPrice: number;
  entryDate: string;
  exitPrice: number | null;
  exitDate: string | null;
  weightPct: number;
  thesis: string;
  sleeveSlug: string;
  sleeveName: string;
}

export interface SleeveMeta {
  slug: string;
  displayName: string;
  inceptionDate: string;
  spInceptionPrice: number;
  isCombined: boolean;
}

export interface HoldingRow extends HoldingInput {
  currentPrice: number | null;
  priceSource: "live" | "manual" | "none";
  recent: RecentPoint[];
  priceAsOf: string | null;
  ret: number | null;
}

export interface ClosedRow extends ClosedInput {
  ret: number | null;
}

export interface SleeveMetrics {
  meta: SleeveMeta;
  holdings: HoldingRow[];
  closed: ClosedRow[];
  totalWeight: number;
  totalReturn: number | null;
  cagr: number | null;
  benchmarkReturn: number | null;
  excessPP: number | null;
  portfolioIndex: number | null;
  spIndex: number | null;
  spCurrent: number | null;
  ageYears: number;
  /** true when at least one open holding has no usable price. */
  hasPriceGaps: boolean;
}

export function computeSleeveMetrics(
  meta: SleeveMeta,
  holdings: HoldingInput[],
  closed: ClosedInput[],
  quotes: QuoteMap,
  now: Date = new Date(),
): SleeveMetrics {
  const rows: HoldingRow[] = holdings.map((h) => {
    const q = quotes[h.ticker.toUpperCase()];
    let currentPrice: number | null;
    let priceSource: HoldingRow["priceSource"];
    if (q && Number.isFinite(q.price)) {
      currentPrice = q.price;
      priceSource = "live";
    } else if (h.manualPrice != null && Number.isFinite(h.manualPrice)) {
      currentPrice = h.manualPrice;
      priceSource = "manual";
    } else {
      currentPrice = null;
      priceSource = "none";
    }
    return {
      ...h,
      currentPrice,
      priceSource,
      recent: q?.recent ?? [],
      priceAsOf: q?.asOf ?? null,
      ret: holdingReturn(h.entryPrice, currentPrice),
    };
  });

  const closedRows: ClosedRow[] = closed.map((c) => ({
    ...c,
    ret: realizedReturn(c.entryPrice, c.exitPrice),
  }));

  const totalReturn = sleeveReturn(
    rows.map((r) => ({ weight: r.weightPct, ret: r.ret })),
  );

  const days = daysBetween(meta.inceptionDate, now);
  const ageYears = days / 365.25;

  const spQuote = quotes[BENCHMARK_SYMBOL];
  const spCurrent = spQuote && Number.isFinite(spQuote.price) ? spQuote.price : null;
  const benchRet = benchmarkReturn(meta.spInceptionPrice, spCurrent);

  return {
    meta,
    holdings: rows,
    closed: closedRows,
    totalWeight: rows.reduce((s, r) => s + (r.weightPct || 0), 0),
    totalReturn,
    cagr: cagr(totalReturn, days),
    benchmarkReturn: benchRet,
    excessPP: excessPoints(totalReturn, benchRet),
    portfolioIndex: toIndex(totalReturn),
    spIndex: toIndex(benchRet),
    spCurrent,
    ageYears,
    hasPriceGaps: rows.some((r) => r.priceSource === "none"),
  };
}

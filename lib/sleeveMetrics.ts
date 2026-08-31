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
  weightPct: number;
  thesis: string;
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
  sleeveName: string;
}

export interface SleeveMeta {
  slug: string;
  displayName: string;
  inceptionDate: string;
  spInceptionPrice: number;
}

export interface HoldingRow extends HoldingInput {
  currentPrice: number | null;
  priceSource: "live" | "manual" | "none";
  recent: RecentPoint[];
  priceAsOf: string | null;
  ret: number | null;
  /** Change since the previous close, in percent (e.g. 1.2 for +1.2%). */
  dayChangePct: number | null;
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
  /** Weight-weighted fund move since the previous close, in percent. */
  dayChangePct: number | null;
  /** Benchmark move since the previous close, in percent. */
  benchmarkDayChangePct: number | null;
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
      dayChangePct:
        priceSource === "live" && q && Number.isFinite(q.changePct)
          ? q.changePct
          : null,
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
  const benchmarkDayChangePct =
    spQuote && Number.isFinite(spQuote.changePct) ? spQuote.changePct : null;

  // Fund's move today: weight-weighted average of holding day changes, over the
  // holdings that have a live quote.
  const dayItems = rows.filter(
    (r) => r.dayChangePct != null && r.weightPct > 0,
  );
  const dayWeight = dayItems.reduce((s, r) => s + r.weightPct, 0);
  const dayChangePct =
    dayWeight > 0
      ? dayItems.reduce((s, r) => s + r.weightPct * (r.dayChangePct as number), 0) /
        dayWeight
      : null;

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
    dayChangePct,
    benchmarkDayChangePct,
    hasPriceGaps: rows.some((r) => r.priceSource === "none"),
  };
}

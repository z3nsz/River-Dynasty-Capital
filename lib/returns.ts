/**
 * Pure return math. No React, no I/O, no money — ratios and index values only.
 *
 *   holdingReturn   = (current - entry) / entry
 *   sleeveReturn    = Σ( (weight_i / Σweight) * holdingReturn_i )   over open positions
 *   CAGR            = (1 + totalReturn) ^ (365.25 / days) - 1
 *   benchmarkReturn = spCurrent / spInceptionPrice - 1
 *   excess (pp)     = (sleeveReturn - benchmarkReturn) * 100
 */

export function holdingReturn(
  entry: number,
  current: number | null | undefined,
): number | null {
  if (current == null || !Number.isFinite(current)) return null;
  if (!Number.isFinite(entry) || entry <= 0) return null;
  return (current - entry) / entry;
}

export interface WeightedReturn {
  weight: number;
  ret: number | null;
}

/**
 * Weight-weighted average of holding returns. Weights are normalised by the sum
 * of weights for positions that actually have a return, so a missing quote for
 * one holding does not silently drag the whole sleeve toward zero.
 */
export function sleeveReturn(items: WeightedReturn[]): number | null {
  let wsum = 0;
  let acc = 0;
  for (const { weight, ret } of items) {
    if (ret == null || !Number.isFinite(ret)) continue;
    if (!Number.isFinite(weight) || weight <= 0) continue;
    wsum += weight;
    acc += weight * ret;
  }
  if (wsum === 0) return null;
  return acc / wsum;
}

export function cagr(totalReturn: number | null, days: number): number | null {
  if (totalReturn == null || !Number.isFinite(totalReturn)) return null;
  if (!Number.isFinite(days) || days < 1) return null;
  const growth = 1 + totalReturn;
  if (growth <= 0) return -1;
  return Math.pow(growth, 365.25 / days) - 1;
}

export function daysBetween(startIso: string, end = new Date()): number {
  const start = new Date(startIso + "T00:00:00Z");
  return (end.getTime() - start.getTime()) / (24 * 3600 * 1000);
}

export function benchmarkReturn(
  spInceptionPrice: number,
  spCurrent: number | null | undefined,
): number | null {
  if (spCurrent == null || !Number.isFinite(spCurrent)) return null;
  if (!Number.isFinite(spInceptionPrice) || spInceptionPrice <= 0) return null;
  return spCurrent / spInceptionPrice - 1;
}

export function excessPoints(
  sleeveRet: number | null,
  benchRet: number | null,
): number | null {
  if (sleeveRet == null || benchRet == null) return null;
  return (sleeveRet - benchRet) * 100;
}

export function realizedReturn(
  entry: number,
  exit: number | null | undefined,
): number | null {
  return holdingReturn(entry, exit ?? null);
}

/** Index value for a growth curve given a return ratio (0.966 -> 196.6). */
export function toIndex(ret: number | null): number | null {
  if (ret == null || !Number.isFinite(ret)) return null;
  return 100 * (1 + ret);
}

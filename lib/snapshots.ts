/**
 * Recording the performance history that drives the growth chart.
 *
 * One row per trading day in the `snapshots` table:
 * { date, portfolio_index, sp_index }, both indexed to 100 at inception. The
 * chart reads these and re-bases them to whatever timeframe the viewer selects.
 *
 * Called from:
 *  - the daily cron (automatic — this is the "recording")
 *  - the admin "Snapshot today" button
 */

import { getServiceClient } from "@/lib/supabase/server";
import { loadPortfolio, selectFund, primarySleeve } from "@/lib/data";
import { readPriceCache } from "@/lib/prices";
import { computeSleeveMetrics } from "@/lib/sleeveMetrics";
import { etDateKey } from "@/lib/market";

export interface SnapshotRow {
  sleeve_id: string | null;
  date: string;
  portfolio_index: number;
  sp_index: number;
}

export interface LogSnapshotResult {
  ok: boolean;
  date: string;
  count: number;
  error?: string;
  rows: SnapshotRow[];
}

/**
 * Compute today's index point for the fund and write it. Idempotent for a given
 * date — re-running replaces that day's row with fresh values (so the daily cron
 * overwriting an earlier manual entry, or vice versa, is fine).
 *
 * @param date  ET calendar date to stamp (defaults to today in ET).
 */
export async function logDailySnapshot(
  date: string = etDateKey(),
): Promise<LogSnapshotResult> {
  const [data, cache] = await Promise.all([loadPortfolio(), readPriceCache()]);
  if (!data.configured) {
    return { ok: false, date, count: 0, error: "database not configured", rows: [] };
  }

  const sleeve = primarySleeve(data);
  const sel = selectFund(data);
  if (!sleeve || !sel) {
    return { ok: false, date, count: 0, error: "no fund configured", rows: [] };
  }

  const m = computeSleeveMetrics(
    sel.meta,
    sel.holdings,
    sel.closed,
    cache.quotes,
    new Date(),
  );
  if (m.portfolioIndex == null || m.spIndex == null) {
    return {
      ok: false,
      date,
      count: 0,
      error: "nothing to snapshot — check that prices are available",
      rows: [],
    };
  }

  const rows: SnapshotRow[] = [
    {
      sleeve_id: sleeve.id,
      date,
      portfolio_index: Number(m.portfolioIndex.toFixed(4)),
      sp_index: Number(m.spIndex.toFixed(4)),
    },
  ];

  const sb = getServiceClient();
  await sb.from("snapshots").delete().eq("date", date);
  const { error } = await sb.from("snapshots").insert(rows);
  if (error) return { ok: false, date, count: 0, error: error.message, rows: [] };

  return { ok: true, date, count: rows.length, rows };
}

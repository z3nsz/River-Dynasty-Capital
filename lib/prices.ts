/**
 * Server-side price cache. The Finnhub API is ONLY ever called from here, to
 * refill the `price_cache` table. Every visitor reads that table (via
 * /api/prices), so the number of API calls is bounded by the refresh schedule,
 * not by traffic.
 */

import { getServiceClient } from "@/lib/supabase/server";
import { fetchQuotes } from "@/lib/finnhub";
import {
  BENCHMARK_SYMBOL,
  RECENT_POINTS_CAP,
  RECENT_MIN_GAP_MS,
  PRICE_CACHE_TTL_SECONDS,
  hasPriceApi,
} from "@/lib/config";
import { isMarketOpen } from "@/lib/market";
import type { QuoteMap, RecentPoint } from "@/lib/types";

interface CacheRow {
  symbol: string;
  price: number | null;
  prev_close: number | null;
  as_of: string | null;
  recent: RecentPoint[] | null;
  updated_at: string;
}

export interface CacheSnapshot {
  quotes: QuoteMap;
  asOf: string | null; // most recent as_of across symbols
}

export async function readPriceCache(): Promise<CacheSnapshot> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("price_cache")
    .select("symbol, price, prev_close, as_of, recent, updated_at");
  if (error) throw error;

  const quotes: QuoteMap = {};
  let asOf: string | null = null;
  for (const row of (data ?? []) as CacheRow[]) {
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

export function cacheAgeSeconds(asOf: string | null): number {
  if (!asOf) return Infinity;
  return (Date.now() - new Date(asOf).getTime()) / 1000;
}

/**
 * Try to grab the shared refresh lock. Returns true if we got it. The lock
 * auto-expires after `staleSeconds` so a crashed refresh can't wedge it.
 */
async function acquireLock(staleSeconds = 30): Promise<boolean> {
  const sb = getServiceClient();
  const cutoff = new Date(Date.now() - staleSeconds * 1000).toISOString();
  const { data, error } = await sb
    .from("refresh_lock")
    .update({ locked_at: new Date().toISOString() })
    .eq("id", 1)
    .lt("locked_at", cutoff)
    .select("id");
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

async function releaseLock() {
  const sb = getServiceClient();
  await sb
    .from("refresh_lock")
    .update({ locked_at: "epoch" })
    .eq("id", 1);
}

/** Distinct tickers of open positions, plus the benchmark. */
async function symbolsToTrack(): Promise<string[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("positions")
    .select("ticker")
    .eq("status", "open");
  if (error) throw error;
  const set = new Set<string>([BENCHMARK_SYMBOL]);
  for (const r of data ?? []) set.add((r as { ticker: string }).ticker.toUpperCase());
  return Array.from(set);
}

export interface RefreshResult {
  ran: boolean;
  reason: string;
  updated: string[];
  missed: string[];
  asOf: string | null;
}

/**
 * Refill the price cache from Finnhub. Safe to call from cron or the admin
 * button. `force` skips the market-open gate (admin can refresh anytime).
 */
export async function refreshPriceCache(
  opts: { force?: boolean } = {},
): Promise<RefreshResult> {
  if (!hasPriceApi()) {
    return { ran: false, reason: "no-api-key", updated: [], missed: [], asOf: null };
  }

  const gotLock = await acquireLock();
  if (!gotLock) {
    const snap = await readPriceCache();
    return { ran: false, reason: "locked", updated: [], missed: [], asOf: snap.asOf };
  }

  try {
    const symbols = await symbolsToTrack();
    const quotes = await fetchQuotes(symbols);
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const sb = getServiceClient();

    // Existing rows (for the rolling `recent` series).
    const { data: existing } = await sb
      .from("price_cache")
      .select("symbol, recent");
    const recentBySym = new Map<string, RecentPoint[]>();
    for (const r of (existing ?? []) as { symbol: string; recent: RecentPoint[] | null }[]) {
      recentBySym.set(r.symbol, Array.isArray(r.recent) ? r.recent : []);
    }

    const appendPoint = isMarketOpen(new Date(now)) || opts.force;
    const updated: string[] = [];
    const missed: string[] = [];

    const rows = symbols.map((sym) => {
      const q = quotes[sym];
      if (!q) {
        missed.push(sym);
        return null;
      }
      updated.push(sym);
      let recent = recentBySym.get(sym) ?? [];
      const last = recent[recent.length - 1];
      if (appendPoint && (!last || now - last.t >= RECENT_MIN_GAP_MS)) {
        recent = [...recent, { t: now, p: q.price }].slice(-RECENT_POINTS_CAP);
      }
      return {
        symbol: sym,
        price: q.price,
        prev_close: q.prevClose,
        as_of: nowIso,
        recent,
        updated_at: nowIso,
      };
    });

    const toUpsert = rows.filter((r): r is NonNullable<typeof r> => r !== null);
    if (toUpsert.length > 0) {
      const { error } = await sb.from("price_cache").upsert(toUpsert, { onConflict: "symbol" });
      if (error) throw error;

      // Keep positions.current_price in step so returns still compute if the
      // cache is ever wiped.
      for (const row of toUpsert) {
        await sb
          .from("positions")
          .update({ current_price: row.price })
          .eq("status", "open")
          .eq("ticker", row.symbol);
      }
    }

    return {
      ran: true,
      reason: "ok",
      updated,
      missed,
      asOf: toUpsert.length ? nowIso : null,
    };
  } finally {
    await releaseLock();
  }
}

/**
 * Read the cache, and if it's stale AND the market is open, kick a refresh
 * first. Used by the public /api/prices endpoint. The lock means a burst of
 * visitors still produces at most one Finnhub refresh.
 */
export async function readPriceCacheWithRefresh(): Promise<
  CacheSnapshot & { refreshed: boolean }
> {
  let snap = await readPriceCache();
  const stale = cacheAgeSeconds(snap.asOf) > PRICE_CACHE_TTL_SECONDS;
  if (hasPriceApi() && stale && isMarketOpen()) {
    try {
      const r = await refreshPriceCache();
      if (r.ran) {
        snap = await readPriceCache();
        return { ...snap, refreshed: true };
      }
    } catch {
      // fall through — serve whatever cache we have
    }
  }
  return { ...snap, refreshed: false };
}

/**
 * Finnhub quote fetching. Server-side only.
 *
 * Finnhub's /quote endpoint takes ONE symbol per call. We fan out with limited
 * concurrency, retry on rate-limit / transient errors with exponential backoff,
 * and tolerate partial failure (a bad symbol just comes back missing).
 *
 * Free tier notes (see README):
 *  - US quotes are ~real-time to 15-min delayed depending on symbol/venue.
 *  - Rate limit ~60 calls/minute. With ~12 symbols that is one comfortable batch.
 *  - Historical candles are NOT on the free tier, so we cannot backfill the
 *    growth curve from Finnhub — snapshots are logged manually instead.
 */

import { finnhubKey } from "./config";

const BASE = "https://finnhub.io/api/v1";
const CONCURRENCY = 5;
const MAX_RETRIES = 3;

export interface RawQuote {
  price: number;
  prevClose: number;
}

export type QuoteResult = Record<string, RawQuote>;

/** Some feeds want a dash instead of a dot for class shares. Finnhub uses the dot. */
export function toFinnhubSymbol(ticker: string): string {
  return ticker.trim().toUpperCase();
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchOne(symbol: string, key: string): Promise<RawQuote | null> {
  const url = `${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 429 || res.status >= 500) {
        if (attempt === MAX_RETRIES) return null;
        await sleep(500 * 2 ** attempt + Math.random() * 250);
        continue;
      }
      if (!res.ok) return null;
      const j = (await res.json()) as {
        c?: number;
        pc?: number;
      };
      // Finnhub returns c === 0 for unknown symbols.
      if (!j || typeof j.c !== "number" || j.c === 0) return null;
      return { price: j.c, prevClose: typeof j.pc === "number" ? j.pc : j.c };
    } catch {
      if (attempt === MAX_RETRIES) return null;
      await sleep(500 * 2 ** attempt);
    }
  }
  return null;
}

/** Fetch quotes for a set of symbols. Missing symbols are simply absent. */
export async function fetchQuotes(symbols: string[]): Promise<QuoteResult> {
  const key = finnhubKey();
  if (!key) return {};

  const unique = Array.from(new Set(symbols.map(toFinnhubSymbol))).filter(Boolean);
  const out: QuoteResult = {};

  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const slice = unique.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (sym) => [sym, await fetchOne(sym, key)] as const),
    );
    for (const [sym, q] of results) {
      if (q) out[sym] = q;
    }
    if (i + CONCURRENCY < unique.length) await sleep(250); // stay under 60/min
  }

  return out;
}

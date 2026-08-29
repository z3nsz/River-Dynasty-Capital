/**
 * Central place for reading environment configuration. Import from here rather
 * than touching process.env directly so missing-config handling stays consistent.
 */

export const BENCHMARK_SYMBOL = (
  process.env.NEXT_PUBLIC_BENCHMARK_SYMBOL || "SPY"
).toUpperCase();

export const BENCHMARK_LABEL = "S&P 500";

export const PRICE_CACHE_TTL_SECONDS = Number(
  process.env.PRICE_CACHE_TTL_SECONDS || "120",
);

/** Poll interval for the open-page client refresh. */
export const CLIENT_POLL_MS = 60_000;

/** Max points kept in each symbol's rolling sparkline series. */
export const RECENT_POINTS_CAP = 120;

/** Minimum gap between appended sparkline points (avoid dupes on rapid refresh). */
export const RECENT_MIN_GAP_MS = 55_000;

// ---- server-only -----------------------------------------------------------

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, anonKey, serviceKey };
}

export function isSupabaseConfigured() {
  const { url, anonKey } = supabaseConfig();
  return Boolean(url && anonKey && !url.includes("YOUR-PROJECT"));
}

export function finnhubKey() {
  const k = process.env.FINNHUB_API_KEY;
  return k && k !== "your-finnhub-key" ? k : null;
}

export function hasPriceApi() {
  return finnhubKey() !== null;
}

export function adminPassword() {
  return process.env.ADMIN_PASSWORD || null;
}

export function authSecret() {
  return process.env.AUTH_SECRET || null;
}

export function cronSecret() {
  return process.env.CRON_SECRET || null;
}

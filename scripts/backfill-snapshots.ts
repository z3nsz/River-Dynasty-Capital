/**
 * Backfill the `snapshots` table with a historical index series.
 *
 * STATUS: stub. This requires a price source with historical data, which
 * Finnhub's FREE tier does NOT provide (the /stock/candle endpoint is paid).
 *
 * When you have such a source (Finnhub paid, Financial Modeling Prep, Tiingo,
 * Alpha Vantage, a CSV export, …), implement `fetchDailyCloses` below. The rest
 * of the logic — walk each month from inception to today, value the portfolio
 * with that day's closes and the SPY close, write {date, portfolio_index,
 * sp_index} rows — is straightforward and mirrors computeSleeveMetrics().
 *
 * Run with:  npx tsx scripts/backfill-snapshots.ts
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

async function fetchDailyCloses(
  _symbol: string,
  _fromISO: string,
  _toISO: string,
): Promise<Record<string, number>> {
  throw new Error(
    "backfill-snapshots: no historical price source configured. " +
      "Finnhub's free tier has no history endpoint — see the comment at the top of this file.",
  );
}

async function main() {
  console.error(
    "This script is a stub. It needs a historical-price data source before it can run.\n" +
      "Until then, log snapshots monthly from the /admin panel — the growth chart builds up over time.",
  );
  process.exit(1);
}

main();

import { NextResponse, type NextRequest } from "next/server";
import { refreshPriceCache } from "@/lib/prices";
import { logDailySnapshot } from "@/lib/snapshots";
import { isUsTradingDay } from "@/lib/market";
import { cronSecret } from "@/lib/config";
import { hasServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Scheduled job, once per weekday after the US close (see vercel.json). It:
 *   1. refreshes the server price cache from Finnhub, and
 *   2. records the fund's performance snapshot for the day so the growth chart
 *      accumulates a real history with no manual work.
 *
 * Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET` automatically.
 * External schedulers (GitHub Actions, cron-job.org) should send the same header.
 * Add `?snapshot=0` to refresh prices without writing a snapshot.
 *
 * Intraday price freshness comes from /api/prices, which refreshes the cache on
 * demand when it's stale and the market is open (deduped by a DB lock, so still
 * not per-visitor). See README "Live pricing".
 */
async function handle(req: NextRequest) {
  const secret = cronSecret();
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  if (!hasServiceClient()) {
    return NextResponse.json(
      { error: "Supabase service role not configured" },
      { status: 503 },
    );
  }

  const result = await refreshPriceCache();

  // Record the day's performance point so the growth chart builds a real
  // history automatically. Only on trading days — no point snapshotting a
  // frozen market on weekends/holidays.
  let snapshot = null;
  const wantSnapshot =
    isUsTradingDay() && new URL(req.url).searchParams.get("snapshot") !== "0";
  if (wantSnapshot) {
    snapshot = await logDailySnapshot().catch((e) => ({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      date: "",
      count: 0,
      rows: [],
    }));
  }

  return NextResponse.json(
    { ok: true, prices: result, snapshot, at: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

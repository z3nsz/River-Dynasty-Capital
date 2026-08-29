import { NextResponse, type NextRequest } from "next/server";
import { refreshPriceCache } from "@/lib/prices";
import { cronSecret } from "@/lib/config";
import { hasServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Scheduled price refresh. Vercel Cron calls this with
 * `Authorization: Bearer $CRON_SECRET` automatically. External schedulers
 * (GitHub Actions, cron-job.org) should send the same header.
 *
 * Scheduled once per weekday after the US close (see vercel.json). Intraday
 * freshness comes from /api/prices, which refreshes the cache on demand when
 * it's stale and the market is open (deduped by a DB lock, so still not
 * per-visitor). See README "Live pricing".
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
  return NextResponse.json(
    { ok: true, ...result, at: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

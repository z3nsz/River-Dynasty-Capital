import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { getServiceClient } from "@/lib/supabase/server";
import { loadPortfolio, primarySleeve } from "@/lib/data";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toIndex(returnPct: unknown): number | null {
  if (returnPct === "" || returnPct == null) return null;
  const n = Number(returnPct);
  if (!Number.isFinite(n)) return null;
  return Number((100 * (1 + n / 100)).toFixed(4));
}

/**
 * Manually enter a historical performance point for the fund.
 *
 * Body: {
 *   date: "YYYY-MM-DD",
 *   sp_return_pct: number,          // S&P 500 return since inception, in %
 *   portfolio_return_pct: number    // the fund's return since inception, in %
 * }
 *
 * Stored as index numbers (100 = inception). Re-posting the same date overwrites
 * it. This is how you import an existing track record — the daily cron records
 * everything from here forward automatically.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const date = String(body.date ?? "");
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const spIndex = toIndex(body.sp_return_pct);
  const portfolioIndex = toIndex(body.portfolio_return_pct);
  if (spIndex == null || portfolioIndex == null) {
    return NextResponse.json(
      { error: "sp_return_pct and portfolio_return_pct are required" },
      { status: 400 },
    );
  }

  const data = await loadPortfolio();
  const sleeve = primarySleeve(data);
  if (!data.configured || !sleeve) {
    return NextResponse.json({ error: "no fund configured" }, { status: 503 });
  }

  const sb = getServiceClient();
  await sb.from("snapshots").delete().eq("date", date);
  const { error } = await sb.from("snapshots").insert({
    sleeve_id: sleeve.id,
    date,
    portfolio_index: portfolioIndex,
    sp_index: spIndex,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, date, count: 1 });
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const date = String(body.date ?? "");
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const sb = getServiceClient();
  const { error } = await sb.from("snapshots").delete().eq("date", date);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, date });
}

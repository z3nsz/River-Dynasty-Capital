import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { logDailySnapshot } from "@/lib/snapshots";
import { etDateKey } from "@/lib/market";

export const dynamic = "force-dynamic";

/**
 * Append (or overwrite) the fund's performance snapshot for a given day.
 * Defaults to today; pass `{ "date": "YYYY-MM-DD" }` to backfill/correct a day.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : etDateKey();

  const result = await logDailySnapshot(date);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, date: result.date, count: result.count });
}

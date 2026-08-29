import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { getServiceClient } from "@/lib/supabase/server";
import { loadPortfolio, selectSleeve } from "@/lib/data";
import { computeSleeveMetrics } from "@/lib/sleeveMetrics";
import { readPriceCache } from "@/lib/prices";
import { COMBINED_SLUG } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Append today's index point for every sleeve + the Combined view. The growth
 * chart is driven entirely by these rows; monthly is a fine cadence.
 */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const [data, cache] = await Promise.all([loadPortfolio(), readPriceCache()]);
  if (!data.configured) {
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const slugs = [COMBINED_SLUG, ...data.sleeves.map((s) => s.slug)];
  const rows: {
    sleeve_id: string | null;
    date: string;
    portfolio_index: number;
    sp_index: number;
  }[] = [];

  for (const slug of slugs) {
    const sel = selectSleeve(slug, data);
    if (!sel) continue;
    const m = computeSleeveMetrics(sel.meta, sel.holdings, sel.closed, cache.quotes, now);
    if (m.portfolioIndex == null || m.spIndex == null) continue;
    const sleeve_id =
      slug === COMBINED_SLUG
        ? null
        : data.sleeves.find((s) => s.slug === slug)?.id ?? null;
    rows.push({
      sleeve_id,
      date: today,
      portfolio_index: Number(m.portfolioIndex.toFixed(4)),
      sp_index: Number(m.spIndex.toFixed(4)),
    });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "nothing to snapshot — check that prices are available" },
      { status: 400 },
    );
  }

  const sb = getServiceClient();
  // Manual upsert: delete today's rows, then insert (NULL sleeve_id makes a
  // single onConflict target awkward).
  await sb.from("snapshots").delete().eq("date", today);
  const { error } = await sb.from("snapshots").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, date: today, count: rows.length });
}

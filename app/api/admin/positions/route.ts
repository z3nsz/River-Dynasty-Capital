import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { getServiceClient } from "@/lib/supabase/server";
import { fetchQuotes } from "@/lib/finnhub";
import { hasPriceApi } from "@/lib/config";

export const dynamic = "force-dynamic";

function num(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const ticker = String(body.ticker ?? "").trim().toUpperCase();
  const company = String(body.company ?? "").trim();
  const sleeve_id = String(body.sleeve_id ?? "").trim();
  const entry_price = num(body.entry_price);
  const entry_date = String(body.entry_date ?? "").trim();
  const weight_pct = num(body.weight_pct);
  const thesis = String(body.thesis ?? "").trim();
  let current_price = num(body.current_price);

  if (!ticker || !company || !sleeve_id || entry_price == null || !entry_date || weight_pct == null) {
    return NextResponse.json(
      { error: "ticker, company, sleeve_id, entry_price, entry_date and weight_pct are required" },
      { status: 400 },
    );
  }

  // Auto-fetch current price if not supplied and we have an API key.
  if (current_price == null && hasPriceApi()) {
    const q = await fetchQuotes([ticker]);
    if (q[ticker]) current_price = q[ticker].price;
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("positions")
    .insert({
      sleeve_id,
      ticker,
      company,
      entry_price,
      entry_date,
      weight_pct,
      thesis,
      current_price,
      status: "open",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, position: data });
}

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { getServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function num(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const EDITABLE = new Set([
  "ticker",
  "company",
  "entry_price",
  "entry_date",
  "weight_pct",
  "current_price",
  "thesis",
  "sleeve_id",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!EDITABLE.has(k)) continue;
    if (["entry_price", "weight_pct", "current_price"].includes(k)) {
      patch[k] = num(v);
    } else if (k === "ticker") {
      patch[k] = String(v).trim().toUpperCase();
    } else {
      patch[k] = typeof v === "string" ? v.trim() : v;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no editable fields supplied" }, { status: 400 });
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("positions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, position: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;

  const sb = getServiceClient();
  const { error } = await sb.from("positions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

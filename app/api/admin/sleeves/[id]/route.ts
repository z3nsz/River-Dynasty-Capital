import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { getServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const EDITABLE = new Set([
  "display_name",
  "inception_date",
  "sp_inception_price",
  "combined_weight",
  "sort_order",
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
    if (["sp_inception_price", "combined_weight", "sort_order"].includes(k)) {
      const n = Number(v);
      if (Number.isFinite(n)) patch[k] = n;
    } else {
      patch[k] = typeof v === "string" ? v.trim() : v;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no editable fields supplied" }, { status: 400 });
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("sleeves")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, sleeve: data });
}

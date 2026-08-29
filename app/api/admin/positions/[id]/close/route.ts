import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { getServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const exit_price = Number(body.exit_price);
  const exit_date = String(body.exit_date ?? "").trim();

  if (!Number.isFinite(exit_price) || exit_price <= 0 || !exit_date) {
    return NextResponse.json(
      { error: "exit_price (> 0) and exit_date are required" },
      { status: 400 },
    );
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("positions")
    .update({ status: "closed", exit_price, exit_date })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, position: data });
}

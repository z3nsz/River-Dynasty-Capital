import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { refreshPriceCache } from "@/lib/prices";
import { hasPriceApi } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!hasPriceApi()) {
    return NextResponse.json(
      { error: "No FINNHUB_API_KEY set — enter prices manually on each position." },
      { status: 400 },
    );
  }

  // Admin can refresh anytime, even with the market closed.
  const result = await refreshPriceCache({ force: true });
  return NextResponse.json({ ok: true, ...result });
}

import { NextResponse } from "next/server";
import { readPriceCacheWithRefresh } from "@/lib/prices";
import { getMarketStatus } from "@/lib/market";
import { hasServiceClient } from "@/lib/supabase/server";
import { hasPriceApi } from "@/lib/config";
import type { PricesResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const market = getMarketStatus();
  const fetchedAt = new Date().toISOString();

  if (!hasServiceClient()) {
    const body: PricesResponse = {
      asOf: null,
      fetchedAt,
      source: "manual",
      market,
      quotes: {},
    };
    return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
  }

  try {
    const { quotes, asOf, refreshed } = await readPriceCacheWithRefresh();
    const body: PricesResponse = {
      asOf,
      fetchedAt,
      source: hasPriceApi() ? (refreshed ? "finnhub" : "cache") : "manual",
      market,
      quotes,
    };
    return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    const body: PricesResponse = {
      asOf: null,
      fetchedAt,
      source: "cache",
      market,
      quotes: {},
    };
    return NextResponse.json(
      { ...body, error: err instanceof Error ? err.message : String(err) },
      { headers: { "cache-control": "no-store" } },
    );
  }
}

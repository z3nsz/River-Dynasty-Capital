import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { hasServiceClient } from "@/lib/supabase/server";

/** For server components. */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}

/**
 * For route handlers. Returns a 401 response to short-circuit, or null when the
 * caller is authenticated. Also fails closed if the DB isn't configured.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const store = await cookies();
  const ok = await verifySessionToken(store.get(ADMIN_COOKIE)?.value);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasServiceClient()) {
    return NextResponse.json(
      { error: "Supabase service role not configured" },
      { status: 503 },
    );
  }
  return null;
}

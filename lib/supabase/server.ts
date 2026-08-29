import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/config";

/**
 * Service-role Supabase client. Bypasses RLS — NEVER import this into a client
 * component or expose it to the browser. Used only by server route handlers
 * that have already passed the admin auth check, and by the price refresh job.
 */
let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;
  const { url, serviceKey } = supabaseConfig();
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service role not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function hasServiceClient(): boolean {
  const { url, serviceKey } = supabaseConfig();
  return Boolean(url && serviceKey && !url.includes("YOUR-PROJECT"));
}

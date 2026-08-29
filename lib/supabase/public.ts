import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig, isSupabaseConfigured } from "@/lib/config";

/**
 * Anon (public) Supabase client. Read-only in practice: RLS policies only allow
 * SELECT on the display tables. Safe to use in server components and route
 * handlers for the public site.
 */
let cached: SupabaseClient | null = null;

export function getPublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (cached) return cached;
  const { url, anonKey } = supabaseConfig();
  cached = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY as string | undefined;

let client: SupabaseClient | null = null;

/**
 * Lazily create the Supabase client so the app doesn't crash on import when
 * env vars are missing. Components should call `getSupabase()` and handle a
 * null return (e.g. by showing a "configure env vars" message).
 */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseKey);
  }
  return client;
}

/**
 * The supabase client, or null if env vars are unset.
 * Kept as `supabase` for backwards-compat with existing imports.
 */
export const supabase = getSupabase();
import { createClient } from '@supabase/supabase-js';

let browserClient: ReturnType<typeof createClient> | undefined;

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return { url, key };
}

export function createBrowserClient() {
  if (!browserClient) {
    const { url, key } = env();
    browserClient = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return browserClient;
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BotAccountConfig } from './config';

export function serviceClient() {
  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function botClient(account: BotAccountConfig): Promise<SupabaseClient> {
  const client = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw new Error(`Bot ${account.personality} authentication failed: ${error.message}`);
  return client;
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

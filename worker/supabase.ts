import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BotAccountConfig } from './config';

const CREDENTIALS_PATH = path.join(import.meta.dirname, '.bot-credentials.json');
type StoredPasswords = Record<string, string>;

export function serviceClient() {
  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Sign in as a bot account, provisioning it first if needed. Accounts are
 * created through the service-role admin API (email pre-confirmed), marked
 * is_bot, and their generated passwords persisted to a gitignored local file
 * so restarts reuse the same accounts.
 */
export async function botClient(account: BotAccountConfig, service: SupabaseClient): Promise<SupabaseClient> {
  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const key = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: true } });

  const stored = await loadStored();
  let password = account.password || stored[account.email];

  if (password) {
    const { error } = await client.auth.signInWithPassword({ email: account.email, password });
    if (!error) return client;
  }

  password = password ?? generatePassword();
  await provisionAccount(account, password, service, url, required('SUPABASE_SERVICE_ROLE_KEY'));

  const { error: signInError } = await client.auth.signInWithPassword({ email: account.email, password });
  if (signInError) throw new Error(`Bot ${account.personality} sign-in failed after provisioning: ${signInError.message}`);
  stored[account.email] = password;
  await saveStored(stored);
  return client;
}

async function provisionAccount(account: BotAccountConfig, password: string, service: SupabaseClient, url: string, serviceKey: string) {
  const existing = await findUserIdByEmail(account.email, url, serviceKey);
  if (existing) {
    const response = await authAdmin(`/admin/users/${existing}`, url, serviceKey, {
      method: 'PUT',
      body: JSON.stringify({ password, email_confirm: true }),
    });
    if (!response.ok) throw new Error(`Bot ${account.personality} password reset failed: ${await response.text()}`);
    const { error } = await service.from('profiles').update({ is_bot: true }).eq('id', existing);
    if (error) throw new Error(`Bot ${account.personality} profile flag failed: ${error.message}`);
    return;
  }
  const response = await authAdmin('/admin/users', url, serviceKey, {
    method: 'POST',
    body: JSON.stringify({
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: { display_name: account.personality },
    }),
  });
  if (!response.ok) throw new Error(`Bot ${account.personality} creation failed: ${await response.text()}`);
  const created = await response.json() as { id: string };
  const { error } = await service.from('profiles').update({ is_bot: true }).eq('id', created.id);
  if (error) throw new Error(`Bot ${account.personality} profile flag failed: ${error.message}`);
}

async function findUserIdByEmail(email: string, url: string, serviceKey: string): Promise<string | null> {
  let page = 1;
  while (page <= 20) {
    const response = await authAdmin(`/admin/users?page=${page}&perPage=1000`, url, serviceKey);
    if (!response.ok) throw new Error(`Admin user lookup failed: ${await response.text()}`);
    const data = await response.json() as { users: Array<{ id: string; email: string }>; totalPages?: number };
    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (page >= (data.totalPages ?? 1)) return null;
    page += 1;
  }
  return null;
}

async function authAdmin(pathname: string, url: string, serviceKey: string, init?: RequestInit) {
  return fetch(`${url}/auth/v1${pathname}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

function generatePassword() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

async function loadStored(): Promise<StoredPasswords> {
  try {
    return JSON.parse(await fs.readFile(CREDENTIALS_PATH, 'utf8')) as StoredPasswords;
  } catch {
    return {};
  }
}

async function saveStored(stored: StoredPasswords) {
  await fs.writeFile(CREDENTIALS_PATH, `${JSON.stringify(stored, null, 2)}\n`, 'utf8');
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

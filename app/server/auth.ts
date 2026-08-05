import { getSupabase } from "../utils/supabase";

export async function isLoggedIn(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function getCurrentUser() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const { data: profile } = await supabase
    .from("users")
    .select("gold")
    .eq("userId", user.id)
    .single();
  return {
    id: user.id,
    email: user.email ?? "",
    gold: profile?.gold ?? 0,
  };
}

export async function createAccount(email: string, password: string) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, error: error.message };
  const uuid = data.user?.id;
  if (!uuid) return { ok: false, error: "Sign up failed" };
  const { error: e } = await supabase
    .from("users")
    .insert({ userId: uuid, gold: 500 });
  if (e) return { ok: false, error: e.message };
  return { ok: true };
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut() {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}
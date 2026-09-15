import 'server-only';
import { createServerClient } from '@/lib/supabase/server';

export async function authenticatedClient(request: Request) {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new Response('Authentication required', { status: 401 });
  const supabase = createServerClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Response('Invalid session', { status: 401 });
  return { supabase, user: data.user };
}

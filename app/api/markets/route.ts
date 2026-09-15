import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('markets')
      .select('id,game_id,status,volume_cents,settled_outcome,created_at,white_q,draw_q,black_q,liquidity_b,games(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const markets = await Promise.all((data ?? []).map(async (market) => {
      const { data: prices } = await supabase.rpc('market_prices', {
        p_white_q: market.white_q, p_draw_q: market.draw_q, p_black_q: market.black_q, p_b: market.liquidity_b,
      });
      const safe = { ...market };
      delete safe.white_q;
      delete safe.draw_q;
      delete safe.black_q;
      delete safe.liquidity_b;
      return { ...safe, prices };
    }));
    return Response.json({ markets }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to load markets' }, { status: 500 });
  }
}

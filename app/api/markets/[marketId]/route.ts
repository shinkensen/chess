import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ marketId: string }> }) {
  try {
    const { marketId } = await context.params;
    const supabase = createServerClient();
    const { data: market, error } = await supabase
      .from('markets')
      .select('*,games(*)')
      .eq('id', marketId)
      .single();
    if (error) return Response.json({ error: 'Market not found' }, { status: 404 });
    const [{ data: prices }, { data: snapshots }, { data: trades }] = await Promise.all([
      supabase.rpc('market_prices', { p_white_q: market.white_q, p_draw_q: market.draw_q, p_black_q: market.black_q, p_b: market.liquidity_b }),
      supabase.from('price_snapshots').select('*').eq('market_id', marketId).order('created_at').limit(240),
      supabase.from('trades').select('id,outcome,side,shares_milli,total_cents,avg_price,metadata,created_at').eq('market_id', marketId).order('created_at', { ascending: false }).limit(30),
    ]);
    const safeMarket = { ...market };
    delete safeMarket.white_q;
    delete safeMarket.draw_q;
    delete safeMarket.black_q;
    delete safeMarket.liquidity_b;
    return Response.json({ market: { ...safeMarket, prices }, snapshots: snapshots ?? [], trades: trades ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to load market' }, { status: 500 });
  }
}

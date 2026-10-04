import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    // Get total count
    const { count } = await supabase
      .from('markets')
      .select('*', { count: 'exact', head: true });

    // Fetch markets with computed prices in a single query
    const { data, error } = await supabase
      .from('markets')
      .select('id,game_id,status,volume_cents,settled_outcome,created_at,white_q,draw_q,black_q,liquidity_b,games(*)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Compute prices client-side in a single pass (avoids N RPC calls)
    const markets = (data ?? []).map((market) => {
      const w = market.white_q / market.liquidity_b;
      const d = market.draw_q / market.liquidity_b;
      const bl = market.black_q / market.liquidity_b;
      const m = Math.max(w, d, bl);
      const ew = Math.exp(w - m);
      const ed = Math.exp(d - m);
      const ebl = Math.exp(bl - m);
      const sum = ew + ed + ebl;

      const prices = {
        white: ew / sum,
        draw: ed / sum,
        black: ebl / sum,
      };

      const safe = { ...market };
      delete safe.white_q;
      delete safe.draw_q;
      delete safe.black_q;
      delete safe.liquidity_b;
      return { ...safe, prices };
    });

    return Response.json(
      { markets, total: count ?? 0, limit, offset },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to load markets' }, { status: 500 });
  }
}

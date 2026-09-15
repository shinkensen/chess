import { authenticatedClient } from '@/lib/supabase/auth';
import { parseTradeInput } from '@/lib/market/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { supabase } = await authenticatedClient(request);
    const input = parseTradeInput(await request.json());
    if (input.limitCents === undefined || !input.idempotencyKey) {
      return Response.json({ error: 'Limit and idempotency key are required' }, { status: 400 });
    }
    const { data, error } = await supabase.rpc('execute_trade', {
      p_market_id: input.marketId,
      p_outcome: input.outcome,
      p_side: input.side,
      p_shares_milli: input.sharesMilli,
      p_limit_cents: input.limitCents,
      p_idempotency_key: input.idempotencyKey,
      p_metadata: { source: 'web' },
    });
    if (error) return Response.json({ error: error.message }, { status: 409 });
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }
}

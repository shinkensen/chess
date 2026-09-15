import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import type { Outcome, PriceSnapshot, TradeRow } from '@/lib/market/types';
import LiveMarketView, { type LiveMarketInitial } from '@/app/components/LiveMarketView';

export const dynamic = 'force-dynamic';

async function getMarket(marketId: string): Promise<LiveMarketInitial | null> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase.from('markets').select('*,games(*)').eq('id', marketId).single();
  if (error || !row) return null;
  const [{ data: snapshotRows }, { data: trades }] = await Promise.all([
    supabase.from('price_snapshots').select('*').eq('market_id', marketId).order('created_at').limit(240),
    supabase.from('trades').select('id,outcome,side,shares_milli,total_cents,metadata,created_at').eq('market_id', marketId).order('created_at', { ascending: false }).limit(20),
  ]);
  const snapshots: PriceSnapshot[] = (snapshotRows ?? []).map((item) => ({ id: item.id, market_id: item.market_id, move_count: item.move_count, created_at: item.created_at, white: Number(item.white_price), draw: Number(item.draw_price), black: Number(item.black_price) }));
  return {
    market: {
      status: row.status,
      volume_cents: Number(row.volume_cents),
      settled_outcome: (row.settled_outcome as Outcome | null) ?? null,
      white_q: Number(row.white_q),
      draw_q: Number(row.draw_q),
      black_q: Number(row.black_q),
      liquidity_b: Number(row.liquidity_b),
    },
    game: row.games,
    snapshots,
    trades: (trades ?? []) as TradeRow[],
  };
}

export default async function MarketPage({ params }: { params: Promise<{ marketId: string }> }) {
  const { marketId } = await params;
  const initial = await getMarket(marketId);
  if (!initial) notFound();
  return (
    <main className="shell page-shell market-page">
      <Link href="/" className="back-link">← All markets</Link>
      <LiveMarketView marketId={marketId} initial={initial} />
    </main>
  );
}

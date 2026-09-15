import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import type { Market, PriceSnapshot, Prices } from '@/lib/market/types';
import Board from '@/app/components/Board';
import ProbabilityChart from '@/app/components/ProbabilityChart';
import TradingPanel from '@/app/components/TradingPanel';

export const dynamic = 'force-dynamic';

type MarketDetail = { market: Market; snapshots: PriceSnapshot[]; trades: TradeRow[] };
type TradeRow = { id: string; outcome: string; side: string; shares_milli: number; total_cents: number; metadata: Record<string, unknown>; created_at: string };

async function getMarket(marketId: string): Promise<MarketDetail | null> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase.from('markets').select('*,games(*)').eq('id', marketId).single();
  if (error || !row) return null;
  const [{ data: prices }, { data: snapshotRows }, { data: trades }] = await Promise.all([
    supabase.rpc('market_prices', { p_white_q: row.white_q, p_draw_q: row.draw_q, p_black_q: row.black_q, p_b: row.liquidity_b }),
    supabase.from('price_snapshots').select('*').eq('market_id', marketId).order('created_at').limit(240),
    supabase.from('trades').select('id,outcome,side,shares_milli,total_cents,metadata,created_at').eq('market_id', marketId).order('created_at', { ascending: false }).limit(20),
  ]);
  const snapshots = (snapshotRows ?? []).map((item) => ({ id: item.id, market_id: item.market_id, move_count: item.move_count, created_at: item.created_at, white: Number(item.white_price), draw: Number(item.draw_price), black: Number(item.black_price) }));
  return { market: { id: row.id, game_id: row.game_id, status: row.status, volume_cents: row.volume_cents, settled_outcome: row.settled_outcome, created_at: row.created_at, games: row.games, prices } as unknown as Market, snapshots, trades: (trades ?? []) as TradeRow[] };
}

export default async function MarketPage({ params }: { params: Promise<{ marketId: string }> }) {
  const { marketId } = await params;
  const detail = await getMarket(marketId);
  if (!detail) notFound();
  const { market, snapshots, trades } = detail;
  const game = market.games;
  const prices = market.prices as Prices;

  return (
    <main className="shell page-shell market-page">
      <Link href="/" className="back-link">← All markets</Link>
      <section className="market-title-row">
        <div><span className={`status status-${market.status}`}><i />{market.status}</span><h1>{game.white_name} <em>vs</em> {game.black_name}</h1><p>Featured Lichess game · Move {game.move_count} · {(market.volume_cents / 100).toLocaleString()} credits traded</p></div>
        <a href={`https://lichess.org/${game.lichess_game_id}`} target="_blank" rel="noreferrer" className="button button-quiet">View on Lichess ↗</a>
      </section>
      <div className="market-layout">
        <div className="market-main-column">
          <section className="board-panel">
            <PlayerBar color="black" name={game.black_name} rating={game.black_rating} clockMs={game.black_clock_ms} />
            <Board fen={game.current_fen ?? 'startpos'} lastMove={game.last_move} />
            <PlayerBar color="white" name={game.white_name} rating={game.white_rating} clockMs={game.white_clock_ms} />
          </section>
          <ProbabilityChart marketId={market.id} initialSnapshots={snapshots} currentPrices={prices} />
          <TradeFeed trades={trades} />
        </div>
        <aside className="market-sidebar"><TradingPanel marketId={market.id} status={market.status} prices={prices} /><BotPanel trades={trades} /></aside>
      </div>
    </main>
  );
}

function PlayerBar({ color, name, rating, clockMs }: { color: 'white' | 'black'; name: string; rating: number | null; clockMs: number | null }) {
  return <div className="player-bar"><span className={`piece ${color}-piece`}>{color === 'white' ? '♔' : '♚'}</span><div><strong>{name}</strong><small>{rating ?? 'Unrated'}</small></div><time>{formatClock(clockMs)}</time></div>;
}

function TradeFeed({ trades }: { trades: TradeRow[] }) {
  return <section className="panel"><div className="panel-heading"><div><span className="eyebrow">TAPE</span><h2>Recent trades</h2></div></div>{trades.length ? <div className="trade-list">{trades.map((trade) => <div key={trade.id}><span className={`trade-side trade-${trade.side}`}>{trade.side}</span><strong>{trade.outcome}</strong><span>{trade.shares_milli / 1000} shares</span><span>{(trade.total_cents / 100).toFixed(2)} cr</span><time>{new Date(trade.created_at).toLocaleTimeString()}</time></div>)}</div> : <div className="empty-inline">No trades yet. The first order will set the tape in motion.</div>}</section>;
}

function BotPanel({ trades }: { trades: TradeRow[] }) {
  const botTrades = trades.filter((trade) => trade.metadata?.source === 'stockfish-bot');
  return <section className="panel bot-panel"><div className="panel-heading"><div><span className="eyebrow">ENGINE DESK</span><h2>Stockfish agents</h2></div><span className="engine-state"><i />Online</span></div><p>Three disclosed agents compare engine probabilities with live market prices.</p><ul><li><i className="bot-dot sage" /><div><strong>Endgame Sage</strong><span>Conservative value</span></div></li><li><i className="bot-dot capital" /><div><strong>Centipawn Capital</strong><span>Balanced engine</span></div></li><li><i className="bot-dot surge" /><div><strong>Tactical Surge</strong><span>Aggressive momentum</span></div></li></ul><small>{botTrades.length} bot trades shown in the recent tape</small></section>;
}

function formatClock(value: number | null) {
  if (value === null) return '—:—';
  const seconds = Math.max(0, Math.ceil(value / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

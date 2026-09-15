'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Game, MarketStatus, Outcome, PriceSnapshot, TradeRow } from '@/lib/market/types';
import { lmsrPrices } from '@/lib/market/lmsr';
import { createBrowserClient } from '@/lib/supabase/client';
import Board from './Board';
import ProbabilityChart from './ProbabilityChart';
import TradingPanel from './TradingPanel';

export interface LiveMarketInitial {
  market: {
    status: MarketStatus;
    volume_cents: number;
    settled_outcome: Outcome | null;
    white_q: number;
    draw_q: number;
    black_q: number;
    liquidity_b: number;
  };
  game: Game;
  snapshots: PriceSnapshot[];
  trades: TradeRow[];
}

type MarketState = LiveMarketInitial['market'];
type GameState = Game;

export default function LiveMarketView({ marketId, initial }: { marketId: string; initial: LiveMarketInitial }) {
  const [market, setMarket] = useState<MarketState>(initial.market);
  const [game, setGame] = useState<GameState>(initial.game);
  const [trades, setTrades] = useState<TradeRow[]>(initial.trades);
  const [clockAnchor, setClockAnchor] = useState(() => ({ receivedAt: Date.now(), whiteMs: initial.game.white_clock_ms, blackMs: initial.game.black_clock_ms }));
  const [now, setNow] = useState(() => Date.now());

  const gameId = initial.game.id;

  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase.channel(`market:${marketId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (message) => {
        const row = message.new as unknown as GameState;
        setGame(row);
        setClockAnchor({ receivedAt: Date.now(), whiteMs: row.white_clock_ms, blackMs: row.black_clock_ms });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'markets', filter: `id=eq.${marketId}` }, (message) => {
        const row = message.new as unknown as MarketState;
        setMarket((current) => ({
          ...current,
          status: row.status ?? current.status,
          volume_cents: row.volume_cents ?? current.volume_cents,
          settled_outcome: row.settled_outcome ?? current.settled_outcome,
          white_q: row.white_q ?? current.white_q,
          draw_q: row.draw_q ?? current.draw_q,
          black_q: row.black_q ?? current.black_q,
        }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trades', filter: `market_id=eq.${marketId}` }, (message) => {
        const row = message.new as unknown as TradeRow;
        setTrades((current) => [row, ...current.filter((trade) => trade.id !== row.id)].slice(0, 30));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [gameId, marketId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const prices = useMemo(
    () => lmsrPrices(market.white_q, market.draw_q, market.black_q, market.liquidity_b),
    [market.white_q, market.draw_q, market.black_q, market.liquidity_b],
  );
  const sideToMove = game.current_fen?.split(' ')[1] === 'b' ? 'black' : 'white';
  const isOver = Boolean(game.completed_at) || market.status === 'settled' || market.status === 'closed' || market.status === 'cancelled';
  const elapsed = Math.max(0, now - clockAnchor.receivedAt);
  const whiteClock = clockAnchor.whiteMs === null ? null : sideToMove === 'white' && !isOver ? clockAnchor.whiteMs - elapsed : clockAnchor.whiteMs;
  const blackClock = clockAnchor.blackMs === null ? null : sideToMove === 'black' && !isOver ? clockAnchor.blackMs - elapsed : clockAnchor.blackMs;

  return (
    <>
      <section className="market-title-row">
        <div><span className={`status status-${market.status}`}><i />{market.status}</span><h1>{game.white_name} <em>vs</em> {game.black_name}</h1><p>Featured Lichess game · Move {game.move_count} · {(market.volume_cents / 100).toLocaleString()} credits traded</p></div>
        <a href={`https://lichess.org/${game.lichess_game_id}`} target="_blank" rel="noreferrer" className="button button-quiet">View on Lichess ↗</a>
      </section>
      <div className="market-layout">
        <div className="market-main-column">
          <section className="board-panel">
            <PlayerBar color="black" name={game.black_name} rating={game.black_rating} clockMs={blackClock} active={sideToMove === 'black' && !isOver} />
            <Board fen={game.current_fen ?? 'startpos'} lastMove={game.last_move} />
            <PlayerBar color="white" name={game.white_name} rating={game.white_rating} clockMs={whiteClock} active={sideToMove === 'white' && !isOver} />
          </section>
          <ProbabilityChart marketId={marketId} initialSnapshots={initial.snapshots} currentPrices={prices} />
          <TradeFeed trades={trades} />
        </div>
        <aside className="market-sidebar"><TradingPanel marketId={marketId} status={market.status} prices={prices} /><BotPanel trades={trades} /></aside>
      </div>
    </>
  );
}

function PlayerBar({ color, name, rating, clockMs, active }: { color: 'white' | 'black'; name: string; rating: number | null; clockMs: number | null; active: boolean }) {
  return <div className={`player-bar${active ? ' player-bar-active' : ''}`}><span className={`piece ${color}-piece`}>{color === 'white' ? '♔' : '♚'}</span><div><strong>{name}</strong><small>{rating ?? 'Unrated'}</small></div><time>{formatClock(clockMs)}</time></div>;
}

function TradeFeed({ trades }: { trades: TradeRow[] }) {
  return <section className="panel"><div className="panel-heading"><div><span className="eyebrow">TAPE</span><h2>Recent trades</h2></div></div>{trades.length ? <div className="trade-list">{trades.map((trade) => <div key={trade.id}><span className={`trade-side trade-${trade.side}`}>{trade.side}</span><strong>{trade.outcome}</strong><span>{trade.shares_milli / 1000} shares</span><span>{(trade.total_cents / 100).toFixed(2)} cr</span><time>{new Date(trade.created_at).toLocaleTimeString()}</time></div>)}</div> : <div className="empty-inline">No trades yet. The first order will set the tape in motion.</div>}</section>;
}

function BotPanel({ trades }: { trades: TradeRow[] }) {
  const botTrades = trades.filter((trade) => trade.metadata?.source === 'stockfish-bot');
  return <section className="panel bot-panel"><div className="panel-heading"><div><span className="eyebrow">ENGINE DESK</span><h2>Engine agents</h2></div><span className="engine-state"><i />Online</span></div><p>Disclosed agents compare engine probabilities with live market prices.</p><ul><li><i className="bot-dot sage" /><div><strong>Endgame Sage</strong><span>Conservative value</span></div></li><li><i className="bot-dot capital" /><div><strong>Centipawn Capital</strong><span>Balanced engine</span></div></li><li><i className="bot-dot surge" /><div><strong>Tactical Surge</strong><span>Aggressive momentum</span></div></li></ul><small>{botTrades.length} bot trades shown in the recent tape</small></section>;
}

function formatClock(value: number | null) {
  if (value === null) return '—:—';
  const seconds = Math.max(0, Math.ceil(value / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

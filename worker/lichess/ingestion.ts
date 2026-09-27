import type { SupabaseClient } from '@supabase/supabase-js';
import type { EndEvent, FeaturedEvent, MoveEvent } from './stream';
import { moveCountFromFen } from './stream';
import { terminalResult, TERMINAL_STATUSES } from './status';

export interface MarketRef {
  gameId: string;
  marketId: string;
  marketStatus: string;
}

const LICHESS_EXPORT_URL = 'https://lichess.org/game/export';

export async function applyFeatured(
  supabase: SupabaseClient,
  event: FeaturedEvent,
  raw: Record<string, unknown>,
): Promise<MarketRef | null> {
  const eventId = `tv:${event.id}:featured:${event.fen}`;
  const { error: eventError } = await supabase.from('ingestion_events').insert({ source: 'lichess', event_id: eventId, payload: raw });
  if (eventError?.code === '23505') return findMarket(supabase, event.id);
  if (eventError) throw eventError;

  const moveCount = moveCountFromFen(event.fen);
  const now = new Date().toISOString();
  const { data: game, error: gameError } = await supabase.from('games').upsert({
    lichess_game_id: event.id,
    source: 'featured',
    white_name: event.white.name,
    black_name: event.black.name,
    white_rating: event.white.rating,
    black_rating: event.black.rating,
    current_fen: event.fen,
    move_count: moveCount,
    white_clock_ms: event.whiteClockMs,
    black_clock_ms: event.blackClockMs,
    status: moveCount > 0 ? 'started' : 'created',
    started_at: moveCount > 0 ? now : null,
    last_event_at: now,
  }, { onConflict: 'lichess_game_id' }).select('id').single();
  if (gameError) throw gameError;
  await supabase.from('ingestion_events').update({ game_id: game.id }).eq('source', 'lichess').eq('event_id', eventId);

  const { data: existing, error: lookupError } = await supabase.from('markets').select('id,status').eq('game_id', game.id).maybeSingle();
  if (lookupError) throw lookupError;
  let market = existing;
  if (!market) {
    const { data, error } = await supabase.from('markets').insert({
      game_id: game.id,
      status: moveCount > 0 ? 'open' : 'scheduled',
      opened_at: moveCount > 0 ? now : null,
    }).select('id,status').single();
    if (error) throw error;
    market = data;
    await snapshotPrices(supabase, market.id, moveCount);
  } else if (market.status === 'scheduled' && moveCount > 0) {
    const { data, error } = await supabase.from('markets').update({ status: 'open', opened_at: now }).eq('id', market.id).select('id,status').single();
    if (error) throw error;
    market = data;
  }
  return { gameId: game.id, marketId: market.id, marketStatus: market.status };
}

export async function applyMove(
  supabase: SupabaseClient,
  ref: MarketRef,
  event: MoveEvent,
): Promise<MarketRef> {
  const moveCount = moveCountFromFen(event.fen);
  const eventId = `tv:${ref.gameId}:m:${event.lastMove ?? ''}:${moveCount}`;
  const { error: eventError } = await supabase.from('ingestion_events').insert({ source: 'lichess', event_id: eventId, game_id: ref.gameId, payload: { fen: event.fen, lm: event.lastMove } });
  if (eventError?.code === '23505') return ref;
  if (eventError) throw eventError;

  const { data: before, error: beforeError } = await supabase.from('games').select('move_count,status').eq('id', ref.gameId).single();
  if (beforeError) throw beforeError;

  const now = new Date().toISOString();
  const { error: gameError } = await supabase.from('games')
    .update({
      current_fen: event.fen,
      last_move: event.lastMove,
      move_count: moveCount,
      white_clock_ms: event.whiteClockMs,
      black_clock_ms: event.blackClockMs,
      status: 'started',
      started_at: before.status === 'created' ? now : undefined,
      last_event_at: now,
    })
    .eq('id', ref.gameId);
  if (gameError) throw gameError;

  let marketStatus = ref.marketStatus;
  if (marketStatus === 'scheduled') {
    const { data, error } = await supabase.from('markets').update({ status: 'open', opened_at: now }).eq('id', ref.marketId).select('status').single();
    if (error) throw error;
    marketStatus = data.status;
  }
  if (before.move_count !== moveCount || marketStatus !== ref.marketStatus) {
    await snapshotPrices(supabase, ref.marketId, moveCount);
  }
  return { ...ref, marketStatus };
}

export async function applyEnd(
  supabase: SupabaseClient,
  ref: MarketRef,
  event: EndEvent,
): Promise<MarketRef> {
  const eventId = `tv:${ref.gameId}:end:${event.status}`;
  const { error: eventError } = await supabase.from('ingestion_events').insert({ source: 'lichess', event_id: eventId, game_id: ref.gameId, payload: event });
  if (eventError?.code === '23505') return ref;
  if (eventError) throw eventError;

  const terminal = terminalResult(event.status, event.winner);
  const now = new Date().toISOString();
  const { error: gameError } = await supabase.from('games').update({
    status: event.status,
    winner: terminal.outcome,
    completed_at: now,
    last_event_at: now,
  }).eq('id', ref.gameId);
  if (gameError) throw gameError;

  const status = terminal.cancelled ? 'cancelled' : 'closed';
  const { error: marketError } = await supabase.from('markets').update({ status, closed_at: now }).eq('id', ref.marketId).in('status', ['open', 'suspended']);
  if (marketError) throw marketError;
  if (terminal.outcome) {
    const { error } = await supabase.rpc('settle_market', { p_market_id: ref.marketId, p_outcome: terminal.outcome });
    if (error) throw error;
    return { ...ref, marketStatus: 'settled' };
  }
  return { ...ref, marketStatus: status };
}
export async function reconcileGame(supabase: SupabaseClient, ref: MarketRef, lichessGameId: string): Promise<MarketRef> {
  try {
    const response = await fetch(`${LICHESS_EXPORT_URL}/${lichessGameId}?moves=false`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return ref;
    const data = await response.json() as Record<string, unknown>;
    const status = String(data.status ?? '');
    if (!TERMINAL_STATUSES.has(status)) return ref;
    const winnerRaw = data.winner;
    const winner = winnerRaw === 'white' || winnerRaw === 'black' ? winnerRaw : winnerRaw === 'draw' ? 'draw' : null;
    return applyEnd(supabase, ref, { type: 'end', status, winner });
  } catch (error) {
    console.error('Reconcile failed', lichessGameId, error);
    return ref;
  }
}

interface PendingGame {
  id: string;
  lichess_game_id: string;
  last_event_at: string;
}


export async function reconcilePendingMarkets(supabase: SupabaseClient, staleAfterMs: number) {
  const cutoff = new Date(Date.now() - staleAfterMs).toISOString();
  const { data: markets, error } = await supabase
    .from('markets')
    .select('id,status,games!inner(id,lichess_game_id,last_event_at)')
    .in('status', ['open', 'suspended']);
  if (error) throw error;
  if (!markets?.length) return { settled: 0, suspended: 0 };

  let settled = 0;
  let suspended = 0;
  for (const market of markets) {
    const embed = market.games as unknown as PendingGame | PendingGame[] | null;
    const game = Array.isArray(embed) ? embed[0] : embed;
    if (!game) continue;
    const stale = game.last_event_at < cutoff;
    
    if (market.status === 'open' && !stale) continue;

    const ref = await reconcileGame(
      supabase,
      { gameId: game.id, marketId: market.id, marketStatus: market.status },
      game.lichess_game_id,
    );
    if (ref.marketStatus === 'settled' || ref.marketStatus === 'cancelled') {
      settled += 1;
      continue;
    }

    if (market.status === 'open' && stale) {
      const { data } = await supabase.from('markets').update({ status: 'suspended' }).eq('id', market.id).eq('status', 'open').select('id');
      if (data?.length) suspended += 1;
    }
  }
  return { settled, suspended };
}

async function snapshotPrices(supabase: SupabaseClient, marketId: string, moveCount: number) {
  const { data: market, error } = await supabase.from('markets').select('white_q,draw_q,black_q,liquidity_b').eq('id', marketId).single();
  if (error || !market) return;
  const { data: prices, error: priceError } = await supabase.rpc('market_prices', {
    p_white_q: market.white_q,
    p_draw_q: market.draw_q,
    p_black_q: market.black_q,
    p_b: market.liquidity_b,
  });
  if (priceError || !prices) return;
  await supabase.from('price_snapshots').insert({
    market_id: marketId,
    move_count: moveCount,
    white_price: prices.white,
    draw_price: prices.draw,
    black_price: prices.black,
  });
}

async function findMarket(supabase: SupabaseClient, lichessGameId: string): Promise<MarketRef | null> {
  const { data, error } = await supabase.from('games').select('id,markets(id,status)').eq('lichess_game_id', lichessGameId).maybeSingle();
  if (error || !data) return null;

  const market = data.markets as unknown as { id: string; status: string } | { id: string; status: string }[] | null;
  const row = Array.isArray(market) ? market[0] : market;
  if (!row) return null;
  return { gameId: data.id, marketId: row.id, marketStatus: row.status };
}

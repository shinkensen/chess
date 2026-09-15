import type { SupabaseClient } from '@supabase/supabase-js';
import type { LichessGameEvent } from './stream';
import { terminalResult } from './status';

export interface PersistedGame {
  gameId: string;
  marketId: string;
  marketStatus: string;
}

export async function persistFeaturedEvent(
  supabase: SupabaseClient,
  event: LichessGameEvent,
  raw: Record<string, unknown>,
): Promise<PersistedGame | null> {
  const eventId = `${event.id}:${event.moveCount}:${event.status}:${event.lastMove ?? ''}`;
  const { error: eventError } = await supabase.from('ingestion_events').insert({ source: 'lichess', event_id: eventId, payload: raw });
  if (eventError?.code === '23505') return null;
  if (eventError) throw eventError;

  const terminal = terminalResult(event.status, event.winner);
  const gameStatus = terminal.terminal ? event.status : event.moveCount > 0 ? 'started' : 'created';
  const now = new Date().toISOString();
  const { data: game, error: gameError } = await supabase.from('games').upsert({
    lichess_game_id: event.id,
    source: 'featured',
    white_name: event.white.name,
    black_name: event.black.name,
    white_rating: event.white.rating,
    black_rating: event.black.rating,
    current_fen: event.fen,
    last_move: event.lastMove,
    move_count: event.moveCount,
    white_clock_ms: event.white.clockMs,
    black_clock_ms: event.black.clockMs,
    status: gameStatus,
    winner: terminal.outcome,
    started_at: event.moveCount > 0 ? now : null,
    completed_at: terminal.terminal ? now : null,
    last_event_at: now,
  }, { onConflict: 'lichess_game_id' }).select('id').single();
  if (gameError) throw gameError;

  const initialMarketStatus = terminal.cancelled ? 'cancelled' : terminal.terminal ? 'closed' : event.moveCount > 0 ? 'open' : 'scheduled';
  const { data: existing, error: lookupError } = await supabase.from('markets').select('id,status').eq('game_id', game.id).maybeSingle();
  if (lookupError) throw lookupError;
  let market = existing;
  if (!market) {
    const { data, error } = await supabase.from('markets').insert({
      game_id: game.id,
      status: initialMarketStatus,
      opened_at: event.moveCount > 0 && !terminal.terminal ? now : null,
      closed_at: terminal.terminal ? now : null,
    }).select('id,status').single();
    if (error) throw error;
    market = data;
  } else if (market.status !== 'settled') {
    const status = terminal.cancelled ? 'cancelled' : terminal.terminal ? 'closed' : event.moveCount > 0 ? 'open' : market.status;
    const { data, error } = await supabase.from('markets').update({
      status,
      opened_at: status === 'open' ? now : undefined,
      closed_at: terminal.terminal ? now : undefined,
    }).eq('id', market.id).select('id,status').single();
    if (error) throw error;
    market = data;
  }
  await supabase.from('ingestion_events').update({ game_id: game.id }).eq('source', 'lichess').eq('event_id', eventId);
  if (terminal.outcome && market.status !== 'settled') {
    const { error } = await supabase.rpc('settle_market', { p_market_id: market.id, p_outcome: terminal.outcome });
    if (error) throw error;
    market.status = 'settled';
  }
  return { gameId: game.id, marketId: market.id, marketStatus: market.status };
}

export async function suspendStaleMarkets(supabase: SupabaseClient, staleAfterMs: number) {
  const cutoff = new Date(Date.now() - staleAfterMs).toISOString();
  const { data: games, error } = await supabase.from('games').select('id').eq('status', 'started').lt('last_event_at', cutoff);
  if (error) throw error;
  if (!games?.length) return 0;
  const { data, error: updateError } = await supabase.from('markets').update({ status: 'suspended' }).eq('status', 'open').in('game_id', games.map((game) => game.id)).select('id');
  if (updateError) throw updateError;
  return data?.length ?? 0;
}

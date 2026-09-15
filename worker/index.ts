import { setTimeout as delay } from 'node:timers/promises';
import { BotTrader } from './bots/trader';
import { loadConfig } from './config';
import { StockfishEngine, evaluationProbabilities } from './engine/stockfish';
import { applyEnd, applyFeatured, applyMove, reconcileGame, suspendStaleMarkets, type MarketRef } from './lichess/ingestion';
import { parseTvEvent, streamNdjson } from './lichess/stream';
import { serviceClient } from './supabase';

const config = loadConfig();
const supabase = serviceClient();
const engine = new StockfishEngine();
const bots = await BotTrader.create(config.botAccounts, supabase);
const shutdown = new AbortController();

interface ChannelState {
  lichessGameId: string | null;
  ref: MarketRef | null;
}

const channels = new Map<string, ChannelState>();
for (const url of config.streamUrls) channels.set(url, { lichessGameId: null, ref: null });

let primary = false;
// Fired when this worker gains the lease so every stream reconnects and
// receives a fresh `featured` event (TV feeds emit it once per connection,
// and events seen before the lease are dropped).
let streamRestart = new AbortController();

process.once('SIGINT', () => shutdown.abort());
process.once('SIGTERM', () => shutdown.abort());

async function acquireLease() {
  const { data, error } = await supabase.rpc('acquire_worker_lease', {
    p_name: 'lichess-featured-ingestion',
    p_holder_id: config.holderId,
    p_lease_seconds: Math.ceil(config.leaseMs / 1000),
  });
  if (error) throw error;
  return data === true;
}

async function keepLease() {
  while (!shutdown.signal.aborted) {
    try {
      const wasPrimary = primary;
      primary = await acquireLease();
      if (primary && !wasPrimary) {
        console.log('Lease acquired — this worker is authoritative');
        const restart = streamRestart;
        streamRestart = new AbortController();
        restart.abort();
      }
      if (!primary && wasPrimary) console.log('Lease lost — standing down');
    } catch (error) {
      primary = false;
      console.error('Lease refresh failed', error);
    }
    await delay(Math.max(1_000, config.leaseMs / 2), undefined, { signal: shutdown.signal }).catch(() => undefined);
  }
}

async function handleEvent(channelUrl: string, raw: Record<string, unknown>) {
  if (!primary) return;
  const event = parseTvEvent(raw);
  if (!event) return;
  const channel = channels.get(channelUrl);
  if (!channel) return;

  try {
    if (event.type === 'featured') {
      if (config.featuredGameIds.size > 0 && !config.featuredGameIds.has(event.id)) {
        if (channel.ref && channel.ref.marketStatus === 'open') await reconcileGame(supabase, channel.ref, channel.lichessGameId ?? '');
        channel.lichessGameId = null;
        channel.ref = null;
        return;
      }
      if (channel.lichessGameId && channel.lichessGameId !== event.id && channel.ref?.marketStatus === 'open') {
        await reconcileGame(supabase, channel.ref, channel.lichessGameId);
      }
      const ref = await applyFeatured(supabase, event, raw);
      if (ref) {
        channel.lichessGameId = event.id;
        channel.ref = ref;
        console.log(`Featured ${event.id}: ${event.white.name} vs ${event.black.name} (market ${ref.marketStatus})`);
        await runBots(ref, event.fen);
      }
    } else if (event.type === 'fen') {
      if (!channel.ref || !event.fen) return;
      channel.ref = await applyMove(supabase, channel.ref, event);
      await runBots(channel.ref, event.fen);
    } else {
      if (!channel.ref) return;
      console.log(`Game ${channel.lichessGameId} ended: ${event.status}${event.winner ? ` (${event.winner})` : ''}`);
      channel.ref = await applyEnd(supabase, channel.ref, event);
    }
  } catch (error) {
    console.error('Ingestion failed', event.type, error);
  }
}

async function runBots(ref: MarketRef, fen: string) {
  if (ref.marketStatus !== 'open' || fen === 'startpos') return;
  try {
    const evaluation = await engine.evaluate(fen);
    const fair = evaluationProbabilities(evaluation, fen);
    await bots.tradeMarket(ref.marketId, fair, supabase);
  } catch (error) {
    console.error('Evaluation failed', error);
  }
}

async function runStream(url: string) {
  let backoffMs = 1_000;
  while (!shutdown.signal.aborted) {
    const connection = new AbortController();
    const abort = () => connection.abort();
    shutdown.signal.addEventListener('abort', abort, { once: true });
    const restart = streamRestart;
    restart.signal.addEventListener('abort', abort, { once: true });
    try {
      await streamNdjson(url, connection.signal, (raw) => handleEvent(url, raw));
      console.warn('Stream ended normally', url);
    } catch (error) {
      if (shutdown.signal.aborted) return;
      if (!restart.signal.aborted) console.error('Stream disconnected', url, error instanceof Error ? error.message : error);
    } finally {
      shutdown.signal.removeEventListener('abort', abort);
      restart.signal.removeEventListener('abort', abort);
    }
    if (shutdown.signal.aborted) return;
    // A restart (lease gained) reconnects immediately; real disconnects back off.
    if (!restart.signal.aborted) {
      await delay(backoffMs, undefined, { signal: shutdown.signal }).catch(() => undefined);
      backoffMs = Math.min(backoffMs * 2, 30_000);
    }
  }
}

async function reconcile() {
  while (!shutdown.signal.aborted) {
    try {
      if (primary) await suspendStaleMarkets(supabase, config.staleAfterMs);
    } catch (error) {
      console.error('Reconciliation failed', error);
    }
    await delay(config.reconciliationMs, undefined, { signal: shutdown.signal }).catch(() => undefined);
  }
}

console.log(`Worker ${config.holderId} watching ${config.streamUrls.length} Lichess TV feed(s)${config.featuredGameIds.size ? ` (allowlist: ${config.featuredGameIds.size} game(s))` : ' (auto-discovery)'} with ${bots.size} bot(s)`);
await Promise.all([keepLease(), ...config.streamUrls.map(runStream), reconcile()]);

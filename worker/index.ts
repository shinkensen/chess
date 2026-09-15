import { setTimeout as delay } from 'node:timers/promises';
import { BotTrader } from './bots/trader';
import { loadConfig } from './config';
import { StockfishEngine, evaluationProbabilities } from './engine/stockfish';
import { persistFeaturedEvent, suspendStaleMarkets } from './lichess/ingestion';
import { normalizeGame, streamNdjson } from './lichess/stream';
import { serviceClient } from './supabase';

const config = loadConfig();
const supabase = serviceClient();
const engine = new StockfishEngine();
const bots = await BotTrader.create(config.botAccounts);
const shutdown = new AbortController();

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

async function handlePayload(raw: Record<string, unknown>) {
  const payload = raw.d && typeof raw.d === 'object' ? raw.d as Record<string, unknown> : raw;
  const event = normalizeGame(payload);
  if (!event.id || !config.featuredGameIds.has(event.id)) return;
  const persisted = await persistFeaturedEvent(supabase, event, raw);
  if (!persisted || persisted.marketStatus !== 'open' || event.fen === 'startpos') return;
  try {
    const evaluation = await engine.evaluate(event.fen);
    const fair = evaluationProbabilities(evaluation, event.fen);
    await bots.tradeMarket(persisted.marketId, fair, supabase);
  } catch (error) {
    console.error('Evaluation failed', event.id, error);
  }
}

async function runStream(url: string) {
  let backoffMs = 1_000;
  while (!shutdown.signal.aborted) {
    try {
      if (!await acquireLease()) {
        await delay(Math.min(config.leaseMs, 10_000), undefined, { signal: shutdown.signal });
        continue;
      }
      await streamNdjson(url, shutdown.signal, handlePayload);
      backoffMs = 1_000;
    } catch (error) {
      if (shutdown.signal.aborted) return;
      console.error('Stream disconnected', url, error);
      await delay(backoffMs, undefined, { signal: shutdown.signal }).catch(() => undefined);
      backoffMs = Math.min(backoffMs * 2, 30_000);
    }
  }
}

async function reconcile() {
  while (!shutdown.signal.aborted) {
    try {
      if (await acquireLease()) await suspendStaleMarkets(supabase, config.staleAfterMs);
    } catch (error) {
      console.error('Reconciliation failed', error);
    }
    await delay(config.reconciliationMs, undefined, { signal: shutdown.signal }).catch(() => undefined);
  }
}

console.log(`Worker ${config.holderId} monitoring ${config.featuredGameIds.size} featured game(s)`);
await Promise.all([...config.streamUrls.map(runStream), reconcile()]);

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Prices } from '../../lib/market/types';
import type { BotAccountConfig } from '../config';
import { botClient } from '../supabase';
import { PERSONALITIES, chooseTrade } from './strategies';

interface BotRuntime {
  account: BotAccountConfig;
  client: SupabaseClient;
  lastTradeAt: Map<string, number>;
}

export class BotTrader {
  private constructor(private readonly bots: BotRuntime[]) {}

  get size() {
    return this.bots.length;
  }

  /**
   * Bots are best-effort: a provisioning failure disables that bot (or all of
   * them) with a warning rather than taking the worker down.
   */
  static async create(accounts: BotAccountConfig[], service: SupabaseClient) {
    const bots: BotRuntime[] = [];
    for (const account of accounts) {
      try {
        bots.push({ account, client: await botClient(account, service), lastTradeAt: new Map<string, number>() });
        console.log(`Bot ${account.personality} signed in`);
      } catch (error) {
        console.warn(`Bot ${account.personality} unavailable: ${error instanceof Error ? error.message : error}`);
      }
    }
    if (accounts.length > 0 && bots.length === 0) console.warn('No bots could be provisioned — continuing without bots');
    return new BotTrader(bots);
  }

  async tradeMarket(marketId: string, fair: Prices, service: SupabaseClient) {
    if (this.bots.length === 0) return;
    const { data: market, error } = await service.from('markets').select('white_q,draw_q,black_q,liquidity_b,status').eq('id', marketId).single();
    if (error || market.status !== 'open') return;
    const { data: prices, error: priceError } = await service.rpc('market_prices', {
      p_white_q: market.white_q,
      p_draw_q: market.draw_q,
      p_black_q: market.black_q,
      p_b: market.liquidity_b,
    });
    if (priceError) throw priceError;
    for (const bot of this.bots) {
      const personality = PERSONALITIES.find((item) => item.name === bot.account.personality);
      if (!personality || Date.now() - (bot.lastTradeAt.get(marketId) ?? 0) < personality.cooldownMs) continue;
      const decision = chooseTrade(personality, fair, prices as Prices);
      if (!decision) continue;
      const { data: quote, error: quoteError } = await bot.client.rpc('quote_trade', {
        p_market_id: marketId,
        p_outcome: decision.outcome,
        p_side: decision.side,
        p_shares_milli: decision.sharesMilli,
      });
      if (quoteError) continue;
      const totalCents = Number(quote.totalCents);
      if (totalCents > personality.maxExposureCents) continue;
      const { error: tradeError } = await bot.client.rpc('execute_trade', {
        p_market_id: marketId,
        p_outcome: decision.outcome,
        p_side: decision.side,
        p_shares_milli: decision.sharesMilli,
        p_limit_cents: Math.ceil(totalCents * 1.02),
        p_idempotency_key: crypto.randomUUID(),
        p_metadata: { source: 'stockfish-bot', personality: personality.name, fair, edge: decision.edge },
      });
      if (!tradeError) {
        bot.lastTradeAt.set(marketId, Date.now());
        console.log(`Bot ${personality.name} bought ${(decision.sharesMilli / 1000).toFixed(1)} ${decision.outcome} shares (edge ${(decision.edge * 100).toFixed(1)}pp)`);
      }
    }
  }
}

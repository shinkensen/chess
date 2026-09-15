'use client';

import { getBrowserEngine, evaluationToProbabilities, getLichessEvaluation, type Probabilities } from './ChessEngine';
import type { Outcome } from '@/lib/market/types';

export interface BotPersonality {
  name: string;
  edge: number;
  maxSharesMilli: number;
  maxExposureCents: number;
  cooldownMs: number;
  aggressiveness: number;
}

export const LOCAL_BOT_PERSONALITIES: BotPersonality[] = [
  {
    name: 'Endgame Sage',
    edge: 0.07,
    maxSharesMilli: 20_000,
    maxExposureCents: 35_000,
    cooldownMs: 25_000,
    aggressiveness: 0.3,
  },
  {
    name: 'Centipawn Capital',
    edge: 0.045,
    maxSharesMilli: 35_000,
    maxExposureCents: 55_000,
    cooldownMs: 16_000,
    aggressiveness: 0.6,
  },
  {
    name: 'Tactical Surge',
    edge: 0.025,
    maxSharesMilli: 55_000,
    maxExposureCents: 75_000,
    cooldownMs: 10_000,
    aggressiveness: 0.9,
  },
];

interface BotState {
  personality: BotPersonality;
  lastTradeAt: number;
  isActive: boolean;
}

export class LocalBotManager {
  private bots: BotState[];
  private useStockfish: boolean;

  constructor(useStockfish = true) {
    this.useStockfish = useStockfish;
    this.bots = LOCAL_BOT_PERSONALITIES.map(personality => ({
      personality,
      lastTradeAt: 0,
      isActive: true,
    }));
  }

  async evaluatePosition(fen: string): Promise<Probabilities> {
    try {
      if (this.useStockfish) {
        const engine = getBrowserEngine();
        const evaluation = await engine.evaluate(fen, 350);
        return evaluationToProbabilities(evaluation, fen);
      } else {
        const evaluation = await getLichessEvaluation(fen);
        return evaluationToProbabilities(evaluation, fen);
      }
    } catch (error) {
      console.error('Evaluation failed, using fallback:', error);
      // Fallback to Lichess API
      const evaluation = await getLichessEvaluation(fen);
      return evaluationToProbabilities(evaluation, fen);
    }
  }

  decideTrade(
    personality: BotPersonality,
    fairPrices: Probabilities,
    marketPrices: Probabilities
  ): { outcome: Outcome; sharesMilli: number; edge: number } | null {
    const outcomes: Outcome[] = ['white', 'draw', 'black'];
    
    // Find best edge
    const opportunities = outcomes.map(outcome => ({
      outcome,
      edge: fairPrices[outcome] - marketPrices[outcome],
    })).sort((a, b) => b.edge - a.edge);

    const best = opportunities[0];

    // Check if edge meets minimum threshold
    if (best.edge < personality.edge) return null;

    // Calculate conviction based on edge size
    const conviction = Math.min(1, (best.edge - personality.edge) / 0.18);
    const shares = Math.max(
      1_000,
      Math.round(personality.maxSharesMilli * (0.25 + conviction * personality.aggressiveness))
    );

    return {
      outcome: best.outcome,
      sharesMilli: shares,
      edge: best.edge,
    };
  }

  async tradeIfNeeded(
    marketId: string,
    fen: string,
    marketPrices: Probabilities,
    executeTrade: (outcome: Outcome, sharesMilli: number, metadata: any) => Promise<boolean>
  ): Promise<number> {
    const now = Date.now();
    let tradesExecuted = 0;

    // Evaluate position once for all bots
    const fairPrices = await this.evaluatePosition(fen);

    for (const bot of this.bots) {
      if (!bot.isActive) continue;

      // Check cooldown
      if (now - bot.lastTradeAt < bot.personality.cooldownMs) continue;

      // Decide if should trade
      const decision = this.decideTrade(bot.personality, fairPrices, marketPrices);
      if (!decision) continue;

      // Execute trade
      try {
        const metadata = {
          source: 'local-bot',
          personality: bot.personality.name,
          fair: fairPrices,
          edge: decision.edge,
          timestamp: new Date().toISOString(),
        };

        const success = await executeTrade(decision.outcome, decision.sharesMilli, metadata);
        
        if (success) {
          bot.lastTradeAt = now;
          tradesExecuted++;
          console.log(`🤖 ${bot.personality.name} bought ${decision.sharesMilli / 1000} ${decision.outcome} shares (edge: ${(decision.edge * 100).toFixed(1)}%)`);
        }
      } catch (error) {
        console.error(`Bot ${bot.personality.name} trade failed:`, error);
      }
    }

    return tradesExecuted;
  }

  getBotStates() {
    return this.bots.map(bot => ({
      name: bot.personality.name,
      isActive: bot.isActive,
      lastTradeAt: bot.lastTradeAt,
      cooldownRemaining: Math.max(0, bot.personality.cooldownMs - (Date.now() - bot.lastTradeAt)),
    }));
  }

  toggleBot(name: string) {
    const bot = this.bots.find(b => b.personality.name === name);
    if (bot) {
      bot.isActive = !bot.isActive;
    }
  }
}

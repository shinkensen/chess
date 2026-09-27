import type { Outcome, Prices } from '../../lib/market/types';

export interface BotPersonality {
  name: string;
  edge: number;
  maxSharesMilli: number;
  maxExposureCents: number;
  cooldownMs: number;
  momentumWeight: number;
}

export const PERSONALITIES: BotPersonality[] = [
  { name: 'Endgame Sage', edge: 0.07, maxSharesMilli: 45_000, maxExposureCents: 80_000, cooldownMs: 25_000, momentumWeight: 0 },
  { name: 'Centipawn Capital', edge: 0.045, maxSharesMilli: 80_000, maxExposureCents: 130_000, cooldownMs: 16_000, momentumWeight: 0.08 },
  { name: 'Tactical Surge', edge: 0.025, maxSharesMilli: 125_000, maxExposureCents: 180_000, cooldownMs: 10_000, momentumWeight: 0.18 },
];

export function poolScale(totalPoolCents: number) {
  const pool = Number.isFinite(totalPoolCents) ? Math.max(0, totalPoolCents) : 0;
  return Math.min(6, 1 + pool / 150_000);
}

export function chooseTrade(personality: BotPersonality, fair: Prices, market: Prices, momentum: Partial<Prices> = {}, scale = 1) {
  const outcomes: Outcome[] = ['white', 'draw', 'black'];
  const ranked = outcomes.map((outcome) => ({
    outcome,
    edge: fair[outcome] - market[outcome] + (momentum[outcome] ?? 0) * personality.momentumWeight,
  })).sort((a, b) => b.edge - a.edge);
  const best = ranked[0];
  if (best.edge < personality.edge) return null;
  const conviction = Math.min(1, (best.edge - personality.edge) / 0.18);
  const base = personality.maxSharesMilli * (0.25 + conviction * 0.75);
  return { outcome: best.outcome, side: 'buy' as const, sharesMilli: Math.max(1_000, Math.round(base * scale)), edge: best.edge };
}

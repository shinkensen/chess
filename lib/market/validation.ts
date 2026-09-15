import type { Outcome, TradeSide } from './types';

const OUTCOMES = new Set<Outcome>(['white', 'draw', 'black']);
const SIDES = new Set<TradeSide>(['buy', 'sell']);

export interface TradeInput {
  marketId: string;
  outcome: Outcome;
  side: TradeSide;
  sharesMilli: number;
  limitCents?: number;
  idempotencyKey?: string;
}

export function parseTradeInput(value: unknown): TradeInput {
  if (!value || typeof value !== 'object') throw new Error('Invalid request body');
  const input = value as Record<string, unknown>;
  if (typeof input.marketId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.marketId)) throw new Error('Invalid market');
  if (!OUTCOMES.has(input.outcome as Outcome)) throw new Error('Invalid outcome');
  if (!SIDES.has(input.side as TradeSide)) throw new Error('Invalid side');
  const sharesMilli = Number(input.sharesMilli);
  if (!Number.isSafeInteger(sharesMilli) || sharesMilli < 1 || sharesMilli > 1_000_000) throw new Error('Shares must be between 0.001 and 1,000');
  const limitCents = input.limitCents === undefined ? undefined : Number(input.limitCents);
  if (limitCents !== undefined && (!Number.isSafeInteger(limitCents) || limitCents < 0)) throw new Error('Invalid limit');
  const idempotencyKey = input.idempotencyKey === undefined ? undefined : String(input.idempotencyKey);
  if (idempotencyKey && !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) throw new Error('Invalid idempotency key');
  return { marketId: input.marketId, outcome: input.outcome as Outcome, side: input.side as TradeSide, sharesMilli, limitCents, idempotencyKey };
}

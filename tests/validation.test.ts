import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTradeInput } from '../lib/market/validation';

const marketId = '11111111-1111-4111-8111-111111111111';
const idempotencyKey = '22222222-2222-4222-8222-222222222222';

test('parses a complete trade request', () => {
  assert.deepEqual(parseTradeInput({ marketId, outcome: 'draw', side: 'buy', sharesMilli: 12_000, limitCents: 450, idempotencyKey }), {
    marketId, outcome: 'draw', side: 'buy', sharesMilli: 12_000, limitCents: 450, idempotencyKey,
  });
});

test('rejects invalid outcomes and unsafe share amounts', () => {
  assert.throws(() => parseTradeInput({ marketId, outcome: 'stalemate', side: 'buy', sharesMilli: 1000 }), /Invalid outcome/);
  assert.throws(() => parseTradeInput({ marketId, outcome: 'white', side: 'buy', sharesMilli: 0 }), /Shares must be/);
  assert.throws(() => parseTradeInput({ marketId, outcome: 'white', side: 'buy', sharesMilli: 1_000_001 }), /Shares must be/);
});

test('rejects malformed identifiers and negative limits', () => {
  assert.throws(() => parseTradeInput({ marketId: 'nope', outcome: 'white', side: 'buy', sharesMilli: 1000 }), /Invalid market/);
  assert.throws(() => parseTradeInput({ marketId, outcome: 'white', side: 'buy', sharesMilli: 1000, limitCents: -1 }), /Invalid limit/);
});

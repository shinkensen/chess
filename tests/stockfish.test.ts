import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluationProbabilities } from '../worker/engine/stockfish';

function sum(prices: ReturnType<typeof evaluationProbabilities>) { return prices.white + prices.draw + prices.black; }

test('engine probabilities remain normalized and bounded', () => {
  for (const centipawns of [-2000, -300, 0, 300, 2000]) {
    const prices = evaluationProbabilities({ centipawns, mate: null, depth: 18 }, '8/8/8/8/8/8/8/8 w - - 0 1');
    assert.ok(Math.abs(sum(prices) - 1) < 1e-10);
    for (const value of Object.values(prices)) assert.ok(value >= 0 && value <= 1);
  }
});

test('side-to-move conversion preserves white perspective', () => {
  const whiteToMove = evaluationProbabilities({ centipawns: 250, mate: null, depth: 18 }, '8/8/8/8/8/8/8/8 w - - 0 1');
  const blackToMove = evaluationProbabilities({ centipawns: -250, mate: null, depth: 18 }, '8/8/8/8/8/8/8/8 b - - 0 1');
  assert.deepEqual(whiteToMove, blackToMove);
  assert.ok(whiteToMove.white > whiteToMove.black);
});

test('mate evaluations strongly favor the winning side', () => {
  const white = evaluationProbabilities({ centipawns: 10_000, mate: 3, depth: 18 }, '8/8/8/8/8/8/8/8 w - - 0 1');
  assert.ok(white.white > 0.98);
  assert.ok(Math.abs(sum(white) - 1) < 1e-10);
});

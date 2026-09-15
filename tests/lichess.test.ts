import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGame } from '../worker/lichess/stream';
import { terminalResult } from '../worker/lichess/status';

test('normalizes a featured Lichess payload', () => {
  const game = normalizeGame({ id: 'abc123', fen: '8/8/8/8/8/8/8/8 b - - 0 1', moves: 'e2e4 e7e5', status: 'started', players: { white: { name: 'Alice', rating: 2100, clock: 59000 }, black: { userId: 'bob', rating: 2050 } } });
  assert.equal(game.id, 'abc123');
  assert.equal(game.lastMove, 'e7e5');
  assert.equal(game.moveCount, 2);
  assert.equal(game.white.name, 'Alice');
  assert.equal(game.black.name, 'bob');
});

test('maps terminal results without guessing cancelled games', () => {
  assert.deepEqual(terminalResult('mate', 'white'), { terminal: true, outcome: 'white', cancelled: false });
  assert.deepEqual(terminalResult('stalemate', null), { terminal: true, outcome: 'draw', cancelled: false });
  assert.deepEqual(terminalResult('aborted', null), { terminal: true, outcome: null, cancelled: true });
  assert.deepEqual(terminalResult('started', null), { terminal: false, outcome: null, cancelled: false });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { moveCountFromFen, parseTvEvent } from '../worker/lichess/stream';
import { terminalResult } from '../worker/lichess/status';

// Fixtures captured from the live Lichess TV feed (2026-09-15).
test('parses a featured TV event', () => {
  const event = parseTvEvent({ t: 'featured', d: { id: '3dGvHgmG', orientation: 'white', players: [
    { color: 'white', user: { name: 'indianstar', title: 'GM', id: 'indianstar' }, rating: 3026, seconds: 60 },
    { color: 'black', user: { name: 'kroonts13', id: 'kroonts13' }, rating: 2809, seconds: 58 },
  ], fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' } });
  assert.equal(event?.type, 'featured');
  if (event?.type !== 'featured') return;
  assert.equal(event.id, '3dGvHgmG');
  assert.equal(event.white.name, 'GM indianstar');
  assert.equal(event.white.rating, 3026);
  assert.equal(event.black.name, 'kroonts13');
  assert.equal(event.whiteClockMs, 60000);
  assert.equal(event.blackClockMs, 58000);
});

test('parses a fen TV event with clocks in seconds', () => {
  const event = parseTvEvent({ t: 'fen', d: { fen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1', lm: 'g1f3', wc: 60, bc: 60 } });
  assert.deepEqual(event, { type: 'fen', fen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1', lastMove: 'g1f3', whiteClockMs: 60000, blackClockMs: 60000 });
});

test('parses an end TV event and ignores unknown event types', () => {
  assert.deepEqual(parseTvEvent({ t: 'end', d: { status: 'mate', winner: 'white' } }), { type: 'end', status: 'mate', winner: 'white' });
  assert.deepEqual(parseTvEvent({ t: 'end', d: { status: 'draw' } }), { type: 'end', status: 'draw', winner: null });
  assert.equal(parseTvEvent({ t: 'whatever', d: {} }), null);
  assert.equal(parseTvEvent(null), null);
});

test('derives move count from the FEN fullmove number', () => {
  assert.equal(moveCountFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'), 1);
  assert.equal(moveCountFromFen('r1bq1rk1/ppp1ppbp/2np1np1/8/4P3/3P1NP1/PPPN1PBP/R1BQ1RK1 w - - 2 7'), 7);
  assert.equal(moveCountFromFen('startpos'), 0);
  assert.equal(moveCountFromFen('bad'), 0);
});

test('maps terminal results without guessing cancelled games', () => {
  assert.deepEqual(terminalResult('mate', 'white'), { terminal: true, outcome: 'white', cancelled: false });
  assert.deepEqual(terminalResult('stalemate', null), { terminal: true, outcome: 'draw', cancelled: false });
  assert.deepEqual(terminalResult('aborted', null), { terminal: true, outcome: null, cancelled: true });
  assert.deepEqual(terminalResult('started', null), { terminal: false, outcome: null, cancelled: false });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseTrade, PERSONALITIES } from '../worker/bots/strategies';

const balanced = PERSONALITIES[1];

test('does not trade below the required edge', () => {
  assert.equal(chooseTrade(balanced, { white: .4, draw: .3, black: .3 }, { white: .39, draw: .31, black: .3 }), null);
});

test('selects the outcome with the largest positive edge', () => {
  const trade = chooseTrade(balanced, { white: .58, draw: .24, black: .18 }, { white: .43, draw: .3, black: .27 });
  assert.equal(trade?.outcome, 'white');
  assert.equal(trade?.side, 'buy');
  assert.ok((trade?.sharesMilli ?? 0) <= balanced.maxSharesMilli);
});

test('momentum affects only personalities configured to use it', () => {
  const market = { white: .34, draw: .33, black: .33 };
  const fair = { white: .34, draw: .33, black: .33 };
  assert.equal(chooseTrade(PERSONALITIES[0], fair, market, { black: 1 }), null);
  assert.equal(chooseTrade(PERSONALITIES[2], fair, market, { black: 1 })?.outcome, 'black');
});

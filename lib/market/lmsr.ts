import type { Prices } from './types';

export function lmsrPrices(whiteQ: number, drawQ: number, blackQ: number, liquidityB: number): Prices {
  const white = whiteQ / liquidityB;
  const draw = drawQ / liquidityB;
  const black = blackQ / liquidityB;
  const max = Math.max(white, draw, black);
  const expWhite = Math.exp(white - max);
  const expDraw = Math.exp(draw - max);
  const expBlack = Math.exp(black - max);
  const total = expWhite + expDraw + expBlack;
  return { white: expWhite / total, draw: expDraw / total, black: expBlack / total };
}

import type { Outcome } from '../../lib/market/types';

const TERMINAL_STATUSES = new Set([
  'mate', 'resign', 'stalemate', 'timeout', 'draw', 'outoftime',
  'cheat', 'noStart', 'aborted', 'unknownFinish', 'variantEnd',
]);

export interface TerminalResult {
  terminal: boolean;
  outcome: Outcome | null;
  cancelled: boolean;
}

export function terminalResult(status: string, winner: Outcome | null): TerminalResult {
  if (!TERMINAL_STATUSES.has(status)) return { terminal: false, outcome: null, cancelled: false };
  if (winner) return { terminal: true, outcome: winner, cancelled: false };
  if (status === 'draw' || status === 'stalemate') {
    return { terminal: true, outcome: 'draw', cancelled: false };
  }
  return { terminal: true, outcome: null, cancelled: true };
}

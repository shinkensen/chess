import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export interface Evaluation { centipawns: number; mate: number | null; depth: number }

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

export class StockfishEngine {
  private useFallback = false;

  constructor(private readonly binary = process.env.STOCKFISH_PATH ?? 'stockfish') {}

  async evaluate(fen: string, moveTimeMs = 350): Promise<Evaluation> {
    if (this.useFallback) return materialEvaluation(fen);
    try {
      return await this.evaluateNative(fen, moveTimeMs);
    } catch (error) {
      const unavailable = error instanceof Error && /ENOENT|spawn|not found/i.test(error.message);
      if (unavailable && !this.useFallback) {
        this.useFallback = true;
        console.warn(`Stockfish binary "${this.binary}" unavailable — using built-in material evaluation for bot decisions`);
      }
      return materialEvaluation(fen);
    }
  }

  private evaluateNative(fen: string, moveTimeMs: number): Promise<Evaluation> {
    return new Promise((resolve, reject) => {
      const engine = spawn(this.binary, [], { stdio: ['pipe', 'pipe', 'pipe'] });
      const lines = createInterface({ input: engine.stdout });
      let best: Evaluation = { centipawns: 0, mate: null, depth: 0 };
      const timer = setTimeout(() => { engine.kill(); reject(new Error('Stockfish timeout')); }, moveTimeMs + 2000);
      lines.on('line', (line) => {
        const match = line.match(/info depth (\d+).* score (cp|mate) (-?\d+)/);
        if (match) best = { depth: Number(match[1]), centipawns: match[2] === 'cp' ? Number(match[3]) : Math.sign(Number(match[3])) * 10000, mate: match[2] === 'mate' ? Number(match[3]) : null };
        if (line.startsWith('bestmove')) { clearTimeout(timer); engine.kill(); resolve(best); }
      });
      engine.on('error', (error) => { clearTimeout(timer); reject(error); });
      engine.stdin.write('uci\n');
      engine.stdin.write(`position fen ${fen}\n`);
      engine.stdin.write(`go movetime ${moveTimeMs}\n`);
    });
  }
}

/**
 * Dependency-free fallback evaluation: material balance from White's perspective,
 * converted to the side-to-move convention the native engine uses.
 */
export function materialEvaluation(fen: string): Evaluation {
  const placement = fen === 'startpos' ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR' : fen.split(' ')[0];
  let whiteCp = 0;
  for (const token of placement) {
    const lower = token.toLowerCase();
    if (PIECE_VALUES[lower] === undefined) continue;
    const value = PIECE_VALUES[lower] * 100;
    whiteCp += token === lower ? -value : value;
  }
  const sideToMove = fen.split(' ')[1] === 'b' ? -1 : 1;
  return { centipawns: whiteCp * sideToMove || 0, mate: null, depth: 0 };
}

export function evaluationProbabilities(evaluation: Evaluation, fen: string) {
  const sideToMove = fen.split(' ')[1] === 'b' ? -1 : 1;
  const whiteCp = evaluation.centipawns * sideToMove;
  if (evaluation.mate !== null) {
    const winning = whiteCp > 0 ? 0.985 : 0.01;
    return { white: winning, draw: 0.005, black: 0.995 - winning };
  }
  const decisive = 1 / (1 + Math.exp(-whiteCp / 310));
  const draw = Math.max(0.06, 0.42 * Math.exp(-Math.abs(whiteCp) / 340));
  return { white: decisive * (1 - draw), draw, black: (1 - decisive) * (1 - draw) };
}

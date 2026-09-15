'use client';

// Browser-based chess engine using Stockfish.js Web Worker
export interface Evaluation {
  centipawns: number;
  mate: number | null;
  depth: number;
}

export interface Probabilities {
  white: number;
  draw: number;
  black: number;
}

class BrowserChessEngine {
  private worker: Worker | null = null;
  private evaluating = false;

  async initialize() {
    if (this.worker) return;
    
    // Create Stockfish Web Worker
    this.worker = new Worker('/stockfish-worker.js');
    
    await new Promise((resolve) => {
      this.worker!.onmessage = (e) => {
        if (e.data === 'ready') resolve(true);
      };
      this.worker!.postMessage('uci');
    });
  }

  async evaluate(fen: string, moveTimeMs = 350): Promise<Evaluation> {
    if (!this.worker) await this.initialize();
    if (this.evaluating) throw new Error('Already evaluating');
    
    this.evaluating = true;

    return new Promise((resolve, reject) => {
      let best: Evaluation = { centipawns: 0, mate: null, depth: 0 };
      const timeout = setTimeout(() => {
        this.evaluating = false;
        reject(new Error('Evaluation timeout'));
      }, moveTimeMs + 2000);

      this.worker!.onmessage = (e) => {
        const line = e.data;
        
        // Parse: info depth 12 score cp 45
        // Parse: info depth 12 score mate 3
        const match = line.match(/info depth (\d+).* score (cp|mate) (-?\d+)/);
        if (match) {
          best = {
            depth: Number(match[1]),
            centipawns: match[2] === 'cp' ? Number(match[3]) : Math.sign(Number(match[3])) * 10000,
            mate: match[2] === 'mate' ? Number(match[3]) : null,
          };
        }

        if (line.startsWith('bestmove')) {
          clearTimeout(timeout);
          this.evaluating = false;
          resolve(best);
        }
      };

      this.worker!.postMessage(`position fen ${fen}`);
      this.worker!.postMessage(`go movetime ${moveTimeMs}`);
    });
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Singleton instance
let engineInstance: BrowserChessEngine | null = null;

export function getBrowserEngine(): BrowserChessEngine {
  if (!engineInstance) {
    engineInstance = new BrowserChessEngine();
  }
  return engineInstance;
}

// Convert evaluation to probabilities
export function evaluationToProbabilities(evaluation: Evaluation, fen: string): Probabilities {
  const sideToMove = fen.split(' ')[1] === 'b' ? -1 : 1;
  const whiteCp = evaluation.centipawns * sideToMove;

  // Forced mate
  if (evaluation.mate !== null) {
    const winning = whiteCp > 0 ? 0.985 : 0.01;
    return { white: winning, draw: 0.005, black: 0.995 - winning };
  }

  // Convert centipawns to win probability using sigmoid
  const decisive = 1 / (1 + Math.exp(-whiteCp / 310));
  const draw = Math.max(0.06, 0.42 * Math.exp(-Math.abs(whiteCp) / 340));

  return {
    white: decisive * (1 - draw),
    draw,
    black: (1 - decisive) * (1 - draw),
  };
}

// Fallback: Use Lichess Cloud Eval API
export async function getLichessEvaluation(fen: string): Promise<Evaluation> {
  try {
    const response = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`);
    const data = await response.json();
    
    if (data.pvs && data.pvs[0]) {
      const pv = data.pvs[0];
      return {
        centipawns: pv.cp ?? (pv.mate ? Math.sign(pv.mate) * 10000 : 0),
        mate: pv.mate ?? null,
        depth: pv.depth ?? 0,
      };
    }
  } catch (error) {
    console.error('Lichess eval failed:', error);
  }
  
  // Fallback to neutral
  return { centipawns: 0, mate: null, depth: 0 };
}

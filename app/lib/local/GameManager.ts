'use client';

import { LocalBotManager } from './LocalBots';
import type { Outcome, Prices } from '@/lib/market/types';

interface LichessGame {
  id: string;
  fen: string;
  lastMove: string | null;
  moveCount: number;
  status: string;
  winner: 'white' | 'draw' | 'black' | null;
  white: { name: string; rating: number | null };
  black: { name: string; rating: number | null };
}

export class LocalGameManager {
  private abortController: AbortController | null = null;
  private botManager: LocalBotManager;
  private activeGames = new Map<string, LichessGame>();

  constructor() {
    this.botManager = new LocalBotManager(true); // Use Stockfish
  }

  async startMonitoring(
    gameIds: string[],
    onGameUpdate: (game: LichessGame) => void,
    onError: (error: Error) => void
  ) {
    this.abortController = new AbortController();

    try {
      const response = await fetch('https://lichess.org/api/tv/feed', {
        signal: this.abortController.signal,
        headers: { Accept: 'application/x-ndjson' },
      });

      if (!response.ok || !response.body) {
        throw new Error(`Lichess stream failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event = JSON.parse(line);
            const game = this.normalizeGame(event);

            // Filter for monitored games
            if (game.id && gameIds.includes(game.id)) {
              this.activeGames.set(game.id, game);
              onGameUpdate(game);
            }
          } catch (parseError) {
            console.error('Failed to parse game event:', parseError);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        onError(error);
      }
    }
  }

  stopMonitoring() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private normalizeGame(payload: any): LichessGame {
    const data = payload.d || payload;
    const players = data.players || {};
    const white = players.white || {};
    const black = players.black || {};
    const moves = typeof data.moves === 'string' ? data.moves.trim().split(/\s+/).filter(Boolean) : [];

    return {
      id: String(data.id || data.gameId || ''),
      fen: String(data.fen || 'startpos'),
      lastMove: moves.at(-1) || (typeof data.lastMove === 'string' ? data.lastMove : null),
      moveCount: Number(data.ply || moves.length),
      status: String(data.status || (moves.length ? 'started' : 'created')),
      winner: this.parseWinner(data.winner),
      white: {
        name: String(white.name || white.userId || 'White'),
        rating: this.parseNumber(white.rating),
      },
      black: {
        name: String(black.name || black.userId || 'Black'),
        rating: this.parseNumber(black.rating),
      },
    };
  }

  private parseWinner(value: any): 'white' | 'draw' | 'black' | null {
    if (value === 'white' || value === 'black') return value;
    if (value === 'draw') return 'draw';
    return null;
  }

  private parseNumber(value: any): number | null {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  async runBotsForGame(
    game: LichessGame,
    marketId: string,
    marketPrices: Prices,
    executeTrade: (outcome: Outcome, sharesMilli: number, metadata: any) => Promise<boolean>
  ) {
    if (game.fen === 'startpos' || game.moveCount === 0) return;

    try {
      await this.botManager.tradeIfNeeded(
        marketId,
        game.fen,
        marketPrices,
        executeTrade
      );
    } catch (error) {
      console.error('Bot trading failed:', error);
    }
  }

  getBotStates() {
    return this.botManager.getBotStates();
  }

  toggleBot(name: string) {
    this.botManager.toggleBot(name);
  }

  getActiveGames() {
    return Array.from(this.activeGames.values());
  }
}

// Singleton instance
let managerInstance: LocalGameManager | null = null;

export function getLocalGameManager(): LocalGameManager {
  if (!managerInstance) {
    managerInstance = new LocalGameManager();
  }
  return managerInstance;
}

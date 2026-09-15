export interface LichessPlayer {
  name: string;
  rating: number | null;
}

export interface FeaturedEvent {
  type: 'featured';
  id: string;
  fen: string;
  white: LichessPlayer;
  black: LichessPlayer;
  whiteClockMs: number | null;
  blackClockMs: number | null;
}

export interface MoveEvent {
  type: 'fen';
  fen: string;
  lastMove: string | null;
  whiteClockMs: number | null;
  blackClockMs: number | null;
}

export interface EndEvent {
  type: 'end';
  status: string;
  winner: 'white' | 'draw' | 'black' | null;
}

export type TvEvent = FeaturedEvent | MoveEvent | EndEvent | null;

/**
 * Parse a Lichess TV NDJSON line. Verified against the live feed
 * (https://lichess.org/api/tv/feed, 2026-09-15):
 *   {"t":"featured","d":{"id":"...","orientation":"white","players":[{"color":"white","user":{"name":"...","title":"GM","id":"..."},"rating":3026,"seconds":60},...],"fen":"..."}}
 *   {"t":"fen","d":{"fen":"...","lm":"g1f3","wc":60,"bc":58}}
 *   {"t":"end","d":{"status":"mate","winner":"white"}}
 */
export function parseTvEvent(raw: unknown): TvEvent {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const type = record.t;
  const data = (record.d ?? {}) as Record<string, unknown>;
  if (type === 'featured') {
    const players = Array.isArray(data.players) ? data.players : [];
    const white = players.find((player) => (player as Record<string, unknown>).color === 'white') as Record<string, unknown> | undefined;
    const black = players.find((player) => (player as Record<string, unknown>).color === 'black') as Record<string, unknown> | undefined;
    return {
      type: 'featured',
      id: String(data.id ?? ''),
      fen: String(data.fen ?? 'startpos'),
      white: toPlayer(white),
      black: toPlayer(black),
      whiteClockMs: secondsToMs(white?.seconds),
      blackClockMs: secondsToMs(black?.seconds),
    };
  }
  if (type === 'fen') {
    return {
      type: 'fen',
      fen: String(data.fen ?? ''),
      lastMove: typeof data.lm === 'string' && data.lm ? data.lm : null,
      whiteClockMs: secondsToMs(data.wc),
      blackClockMs: secondsToMs(data.bc),
    };
  }
  if (type === 'end') {
    const winner = data.winner;
    return {
      type: 'end',
      status: String(data.status ?? 'unknown'),
      winner: winner === 'white' || winner === 'black' || winner === 'draw' ? winner : null,
    };
  }
  return null;
}

function toPlayer(player: Record<string, unknown> | undefined): LichessPlayer {
  const user = (player?.user ?? {}) as Record<string, unknown>;
  const rating = Number(player?.rating);
  return {
    name: [user.title, user.name].filter(Boolean).join(' ') || String(user.id ?? 'Anonymous'),
    rating: Number.isFinite(rating) && rating > 0 ? rating : null,
  };
}

function secondsToMs(value: unknown): number | null {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : null;
}

/** Fullmove number (FEN field 6) — stable across worker restarts, unlike counting events. */
export function moveCountFromFen(fen: string): number {
  const fullmove = Number(fen.split(' ')[5]);
  return Number.isInteger(fullmove) && fullmove > 0 ? fullmove : 0;
}

export async function streamNdjson(
  url: string,
  signal: AbortSignal,
  onEvent: (event: Record<string, unknown>) => Promise<void>,
  idleTimeoutMs = 120_000,
) {
  // Own controller so the idle watchdog can drop a silent connection without
  // touching the caller's (longer-lived) signal.
  const connection = new AbortController();
  const abort = () => connection.abort();
  signal.addEventListener('abort', abort, { once: true });
  let watchdog: NodeJS.Timeout | undefined;
  const pet = () => {
    if (watchdog) clearTimeout(watchdog);
    watchdog = setTimeout(abort, idleTimeoutMs);
  };
  try {
    const response = await fetch(url, { signal: connection.signal, headers: { Accept: 'application/x-ndjson' } });
    if (!response.ok || !response.body) throw new Error(`Lichess stream failed: ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    pet();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        pet();
        await onEvent(JSON.parse(line));
      }
    }
  } finally {
    if (watchdog) clearTimeout(watchdog);
    signal.removeEventListener('abort', abort);
  }
}

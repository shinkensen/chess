export interface LichessGameEvent {
  id: string;
  fen: string;
  lastMove: string | null;
  moveCount: number;
  status: string;
  winner: 'white' | 'draw' | 'black' | null;
  white: { name: string; rating: number | null; clockMs: number | null };
  black: { name: string; rating: number | null; clockMs: number | null };
}

export function normalizeGame(payload: Record<string, unknown>): LichessGameEvent {
  const players = (payload.players ?? {}) as Record<string, Record<string, unknown>>;
  const white = players.white ?? {};
  const black = players.black ?? {};
  const moves = typeof payload.moves === 'string' ? payload.moves.trim().split(/\s+/).filter(Boolean) : [];
  const winnerRaw = payload.winner;
  return {
    id: String(payload.id ?? payload.gameId ?? ''),
    fen: String(payload.fen ?? payload.initialFen ?? 'startpos'),
    lastMove: moves.at(-1) ?? (typeof payload.lastMove === 'string' ? payload.lastMove : null),
    moveCount: Number(payload.ply ?? moves.length),
    status: String(payload.status ?? (moves.length ? 'started' : 'created')),
    winner: winnerRaw === 'white' || winnerRaw === 'black' ? winnerRaw : winnerRaw === 'draw' ? 'draw' : null,
    white: { name: String(white.name ?? white.userId ?? 'White'), rating: numberOrNull(white.rating), clockMs: numberOrNull(white.clock) },
    black: { name: String(black.name ?? black.userId ?? 'Black'), rating: numberOrNull(black.rating), clockMs: numberOrNull(black.clock) },
  };
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function streamNdjson(url: string, signal: AbortSignal, onEvent: (event: Record<string, unknown>) => Promise<void>) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/x-ndjson' } });
  if (!response.ok || !response.body) throw new Error(`Lichess stream failed: ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) if (line.trim()) await onEvent(JSON.parse(line));
  }
}

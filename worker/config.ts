export interface BotAccountConfig {
  personality: string;
  email: string;
  password: string;
}

export interface WorkerConfig {
  holderId: string;
  featuredGameIds: Set<string>;
  streamUrls: string[];
  reconciliationMs: number;
  staleAfterMs: number;
  leaseMs: number;
  botAccounts: BotAccountConfig[];
}

const DEFAULT_STREAM_URLS = [
  'https://lichess.org/api/tv/feed',
  'https://lichess.org/api/tv/blitz/feed',
  'https://lichess.org/api/tv/rapid/feed',
  'https://lichess.org/api/tv/classical/feed',
];

const DEFAULT_BOT_ACCOUNTS: BotAccountConfig[] = [
  { personality: 'Endgame Sage', email: 'endgame-sage@betchess-bots.example.com', password: '' },
  { personality: 'Centipawn Capital', email: 'centipawn-capital@betchess-bots.example.com', password: '' },
  { personality: 'Tactical Surge', email: 'tactical-surge@betchess-bots.example.com', password: '' },
];

export function loadConfig(): WorkerConfig {
  return {
    holderId: process.env.WORKER_HOLDER_ID ?? crypto.randomUUID(),
    // Optional filter: when empty every TV game gets a market.
    featuredGameIds: new Set(splitEnv('FEATURED_LICHESS_GAME_IDS')),
    streamUrls: splitEnv('LICHESS_STREAM_URLS', DEFAULT_STREAM_URLS),
    reconciliationMs: positiveInt('RECONCILIATION_MS', 15_000),
    staleAfterMs: positiveInt('STALE_AFTER_MS', 60_000),
    leaseMs: positiveInt('WORKER_LEASE_MS', 30_000),
    botAccounts: parseBotAccounts(process.env.BOT_ACCOUNTS_JSON, DEFAULT_BOT_ACCOUNTS),
  };
}

function splitEnv(name: string, fallback: string[] = []) {
  return process.env[name]?.split(',').map((value) => value.trim()).filter(Boolean) ?? fallback;
}

function positiveInt(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function parseBotAccounts(raw: string | undefined, fallback: BotAccountConfig[]): BotAccountConfig[] {
  if (!raw) return fallback;
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('BOT_ACCOUNTS_JSON must be an array');
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid bot account');
    const record = item as Record<string, unknown>;
    if (typeof record.personality !== 'string' || typeof record.email !== 'string') {
      throw new Error('Each bot account needs at least personality and email');
    }
    return { personality: record.personality, email: record.email, password: typeof record.password === 'string' ? record.password : '' };
  });
}

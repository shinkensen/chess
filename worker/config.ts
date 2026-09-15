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

export function loadConfig(): WorkerConfig {
  const featuredGameIds = new Set(splitEnv('FEATURED_LICHESS_GAME_IDS'));
  if (!featuredGameIds.size) throw new Error('FEATURED_LICHESS_GAME_IDS must contain at least one game ID');

  return {
    holderId: process.env.WORKER_HOLDER_ID ?? crypto.randomUUID(),
    featuredGameIds,
    streamUrls: splitEnv('LICHESS_STREAM_URLS', ['https://lichess.org/api/tv/feed']),
    reconciliationMs: positiveInt('RECONCILIATION_MS', 15_000),
    staleAfterMs: positiveInt('STALE_AFTER_MS', 60_000),
    leaseMs: positiveInt('WORKER_LEASE_MS', 30_000),
    botAccounts: parseBotAccounts(process.env.BOT_ACCOUNTS_JSON),
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

function parseBotAccounts(raw: string | undefined): BotAccountConfig[] {
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('BOT_ACCOUNTS_JSON must be an array');
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid bot account');
    const record = item as Record<string, unknown>;
    if (typeof record.personality !== 'string' || typeof record.email !== 'string' || typeof record.password !== 'string') {
      throw new Error('Each bot account needs personality, email, and password');
    }
    return { personality: record.personality, email: record.email, password: record.password };
  });
}

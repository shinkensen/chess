# BetChess setup and operations

## Requirements

- Node.js 20 or newer and npm.
- A Supabase project (cloud or local CLI stack).
- Optional: a Stockfish executable for stronger bot evaluation.

All balances are fictional play credits. New accounts receive exactly 10,000 credits and there is no deposit, withdrawal, prize, or cash-redemption path.

## Environment

Copy `.env.example` to `.env`. Required:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (web app + worker)
- `SUPABASE_SERVICE_ROLE_KEY` (worker only; never expose it in a `NEXT_PUBLIC_` variable)

Optional (see `.env.example` for details):

- `FEATURED_LICHESS_GAME_IDS` — restrict markets to specific games. Unset = every game on the TV feeds gets a market.
- `LICHESS_STREAM_URLS` — NDJSON feeds to watch. Defaults to the main TV feed plus blitz, rapid, and classical channels.
- `STOCKFISH_PATH` — Stockfish executable. Unset = bots use the built-in material evaluation.
- `WORKER_LEASE_MS`, `RECONCILIATION_MS`, `STALE_AFTER_MS` — worker timing.
- `BOT_ACCOUNTS_JSON` — override the default bot accounts. Unset = three bots are auto-provisioned.

Never commit a real `.env` file.

## Database

The authoritative schema is `supabase/migrations/202609100001_rebuild_prediction_market.sql` (plus the two follow-up migrations in that directory). With a linked Supabase CLI project:

```bash
supabase db push
```

For a disposable local stack:

```bash
supabase start
supabase db reset
```

The migration creates auth profile provisioning (with a 10,000-credit wallet and ledger entry), games and markets, LMSR quote/execution RPCs, settlement, worker leases, RLS policies, and Supabase Realtime publication entries.

Before production, verify in a staging project that anonymous/authenticated roles cannot directly insert or update wallets, games, markets, positions, trades, snapshots, leases, or ingestion events.

## Bot accounts

On first start the worker creates the three bot users (Endgame Sage, Centipawn Capital, Tactical Surge) through the service-role admin API, marks their profiles `is_bot`, and signs them in. Generated passwords are persisted to `worker/.bot-credentials.json` (gitignored) and reused on restarts. Bots trade through the same authenticated atomic RPC as human users; their trades are tagged in the tape with `metadata.source = "stockfish-bot"`.

## Run locally

```bash
npm install
npm run dev     # web app
npm run worker  # ingestion + bots, run separately
```

The worker holds a database lease (`worker_leases`); only the lease holder ingests, reconciles, and settles. Markets appear automatically as games show up on the watched Lichess TV feeds — no game IDs need to be configured.

## Market lifecycle

1. A `featured` event on a TV feed creates the game and a `scheduled` market (a snapshot records the opening prices).
2. The first move opens trading; every move updates the position/clocks and writes a price snapshot.
3. Users and bots buy/sell White / Draw / Black shares at exact LMSR quotes; prices move with every trade.
4. A terminal result closes the market and the worker settles the exact outcome; winners are paid 100¢ per share. Abort/no-contest statuses cancel instead of guessing.
5. If TV rotates away from a game that is still in progress, the worker fetches the game's final state from the Lichess export API: finished games settle, otherwise the market suspends until events resume (a new authoritative event reopens it).

## Validation

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## VM deployment

1. Install Node.js 20+ and npm (Stockfish optional).
2. Deploy the repository to `/opt/betchess` and run `npm ci` plus `npm run build`.
3. Create `/etc/betchess/worker.env` from `.env.example`, readable only by the service account.
4. Create a non-login `betchess` user and grant it read access to the deployment.
5. Copy `deploy/betchess-worker.service` to `/etc/systemd/system/`, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now betchess-worker
sudo systemctl status betchess-worker
```

Inspect logs with `journalctl -u betchess-worker -f`. Health is a current `worker_leases.heartbeat_at` and recent `games.last_event_at`. Run only one configured replica; the lease is a safety mechanism, not a reason to run multiple workers. First start on a fresh machine provisions the bot accounts automatically (needs the service-role key).

To roll back, stop the unit, deploy the previous application version, and restore a tested database backup if a migration must be reversed. Do not hand-edit balances or delete ledger rows.

## Troubleshooting

- **No markets appear:** check the worker is running and prints "Lease acquired"; then confirm the TV feeds are reachable (`curl -s -H "Accept: application/x-ndjson" https://lichess.org/api/tv/feed | head`). If `FEATURED_LICHESS_GAME_IDS` is set, only those games are accepted.
- **Market stays scheduled:** the game has not made its first move yet.
- **Market is suspended:** the TV feed rotated away mid-game; reconciliation settles it if it finished, otherwise it waits for events.
- **Bots not trading:** bots only trade when engine evaluation diverges from market prices by their edge threshold — an equal position at even prices gives them no edge. Check the worker log for "Bot … signed in" lines.
- **Quotes return 401:** the browser session expired or the Authorization bearer token is absent.
- **Realtime appears stale:** verify the migration added games, markets, trades, snapshots, wallets, and positions to `supabase_realtime`; refreshing the page is always safe because the database is authoritative.

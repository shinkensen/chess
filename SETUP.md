# BetChess setup and operations

## Requirements

- Node.js 20 or newer and npm.
- A Supabase project or local Supabase CLI stack.
- Stockfish installed on the always-on worker VM.
- Three dedicated Supabase Auth users if bot trading is enabled.

All balances are fictional play credits. New accounts receive exactly 10,000 credits and there is no deposit, withdrawal, prize, or cash-redemption path.

## Environment

Copy `.env.example` to `.env.local` for local development. Supply:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the web app.
- `SUPABASE_SERVICE_ROLE_KEY` only to trusted server/worker processes.
- `FEATURED_LICHESS_GAME_IDS` as the explicit allowlist monitored by the worker.
- `STOCKFISH_PATH` as the Stockfish executable path.
- `BOT_ACCOUNTS_JSON` with dedicated bot credentials, or `[]` to disable bots.

Never expose the service-role key in a `NEXT_PUBLIC_` variable or commit a real `.env` file.

## Database

The authoritative schema is `supabase/migrations/202609100001_rebuild_prediction_market.sql`. The root-level legacy SQL files document the retired prototype and must not be applied.

With a linked Supabase CLI project:

```bash
supabase db push
```

For a disposable local stack:

```bash
supabase start
supabase db reset
```

The migration creates Auth profile provisioning, 10,000-credit wallets, ledger and positions, game/market data, LMSR quote/execution RPCs, settlement, worker leases, RLS, and Realtime publication entries.

Before production, verify in a staging project that anonymous/authenticated roles cannot directly insert or update wallets, games, markets, positions, trades, snapshots, leases, or ingestion events.

## Bot accounts

Create three normal Auth users through Supabase Auth. Their profile rows are created by the signup trigger. Mark the corresponding profiles as bots from a trusted SQL/service-role context:

```sql
update public.profiles
set is_bot = true
where id in ('BOT_USER_UUID_1', 'BOT_USER_UUID_2', 'BOT_USER_UUID_3');
```

Configure their personality names exactly as `Endgame Sage`, `Centipawn Capital`, and `Tactical Surge`. Each bot signs in normally and trades through the same authenticated atomic RPC as human users.

## Run locally

```bash
npm install
npm run dev
```

Run the worker separately after installing Stockfish:

```bash
npm run worker
```

The worker refuses to start without a featured-game allowlist. Only the process holding the database lease ingests, reconciles, evaluates, and trades. A disconnected active market is suspended after `STALE_AFTER_MS`; a new authoritative event may reopen it.

## Validation

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

Database integration validation additionally requires a disposable Supabase instance. Test first-move rejection, insufficient funds/shares, buy/sell slippage, duplicate idempotency keys, concurrent trades, repeat settlement, and RLS denial of direct mutations.

## Existing VM deployment

1. Install Node.js 20+, npm, and Stockfish.
2. Deploy the repository to `/opt/betchess` and run `npm ci` plus `npm run build`.
3. Create `/etc/betchess/worker.env` from `.env.example`, with permissions readable only by the service account.
4. Create a non-login `betchess` user and grant it read access to the deployment and Stockfish executable.
5. Copy `deploy/betchess-worker.service` to `/etc/systemd/system/`.
6. Run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now betchess-worker
sudo systemctl status betchess-worker
```

Inspect logs with `journalctl -u betchess-worker -f`. Health is represented by a current `worker_leases.heartbeat_at` and recent `games.last_event_at`. Run only one configured replica; the lease is a safety mechanism, not a reason to intentionally run multiple active workers.

To roll back, stop the unit, deploy the previous application version, and restore a tested database backup if the migration itself must be reversed. Do not hand-edit balances or delete ledger rows.

## Market lifecycle

1. Worker discovers an explicitly featured Lichess game and creates a scheduled market.
2. The first confirmed move changes the game to `started` and opens trading.
3. Authenticated users obtain exact quotes and execute atomic buy/sell orders.
4. Price snapshots and account updates reach clients through Supabase Realtime.
5. A terminal result closes the market and the service-role worker settles the exact White, Draw, or Black outcome.
6. Abort/no-contest statuses cancel rather than guess a winner.

## Troubleshooting

- **Market stays scheduled:** confirm the game ID is allowlisted and an event with `move_count >= 1` reached the worker.
- **Market is suspended:** inspect stream connectivity and `games.last_event_at`; reconciliation suspends stale games intentionally.
- **Stockfish failures:** run the configured binary as the service user and check `STOCKFISH_PATH`.
- **Quotes return 401:** the browser session expired or the Authorization bearer token is absent.
- **Realtime appears stale:** verify the migration added games, markets, trades, snapshots, wallets, and positions to `supabase_realtime`; the UI can be refreshed safely because the database is authoritative.

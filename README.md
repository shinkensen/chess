# BetChess

BetChess is a play-money, three-outcome prediction market for selected featured Lichess games. Users receive **10,000 credits with no cash value** and can buy or sell White, Draw, and Black outcome shares while a game is live.

## Architecture

- Next.js 16 App Router frontend and authenticated Route Handlers.
- Supabase Auth, PostgreSQL, RLS, Realtime, immutable wallet ledger, and atomic RPCs.
- Three-outcome LMSR automated market maker with fixed-point credits and shares.
- Always-on Lichess ingestion worker with a database lease and reconciliation.
- Bounded Stockfish evaluation powering three disclosed bot personalities.

Trading remains locked until the first confirmed move and closes on an authoritative terminal Lichess result. A winning full share settles for one play credit.

## Quick start

1. Install Node.js 20+, Supabase CLI, and Stockfish.
2. Copy `.env.example` to `.env.local` and supply your own credentials.
3. Apply `supabase/migrations/202609100001_rebuild_prediction_market.sql` using the Supabase CLI.
4. Run `npm install`, then `npm run dev`.
5. In a separate process, run `npm run worker`.

See [SETUP.md](SETUP.md) for database, worker, bot-account, and VM deployment details.

## Commands

```bash
npm run dev        # development server
npm run worker     # ingestion, settlement, engine, and bot worker
npm run test       # unit tests
npm run typecheck  # TypeScript validation
npm run lint       # ESLint
npm run build      # production build
```

## Security model

Browser clients cannot directly mutate wallets, positions, markets, trades, or game state. Authenticated trades run through locked, idempotent PostgreSQL RPCs. Service-role credentials are worker-only and must never use a `NEXT_PUBLIC_` environment variable.

This project is entertainment software using fictional credits. It does not support deposits, withdrawals, prizes, or cash redemption.

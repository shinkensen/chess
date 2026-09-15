# Local Browser-Based Architecture - Implementation Plan

## Overview
Revamp BetChess to run entirely in the browser with no backend worker process.

---

## Architecture Changes

### Before (Current)
- **Worker Process**: Node.js worker ingests Lichess stream
- **Stockfish**: Binary executable evaluates positions
- **Bots**: Server-side authenticated accounts
- **Polling**: Client polls API every 3 seconds

### After (New)
- **Browser Client**: Directly fetches from Lichess API
- **Chess Engine API**: Browser calls external evaluation API
- **Bots**: Simulated in browser, trade via user's session
- **Real-time**: Browser manages everything locally

---

## Implementation Steps

### 1. Remove Worker Process
- Delete `worker/` directory
- Remove worker-related configs
- Remove Stockfish dependency

### 2. Create Browser-Based Game Manager
**Location**: `app/lib/local/GameManager.ts`
- Fetch Lichess stream directly from browser
- Parse NDJSON in browser
- Manage game state client-side
- Store in React state/context

### 3. Add Chess Evaluation API
**Options**:
- Lichess Cloud Eval API: `https://lichess.org/api/cloud-eval`
- Chess.com API
- Stockfish.js (WebAssembly in browser)

**Implementation**: `app/lib/local/ChessEngine.ts`
- Call external API for position evaluation
- Convert to probabilities (white/draw/black)
- Cache evaluations

### 4. Create Local Bot System
**Location**: `app/lib/local/LocalBots.ts`
- Simulate bot personalities (Sage, Capital, Surge)
- Use evaluation API to determine fair prices
- Execute trades via user's authenticated session
- Add random delays for realism

### 5. Update Database Schema
- Keep markets/trades/positions
- Remove worker leases table
- Add `is_bot_market` flag for local markets

### 6. Create Local Market Component
**Location**: `app/components/LocalMarketManager.tsx`
- Fetch Lichess games directly
- Call evaluation API
- Run bot logic locally
- Update markets in database

---

## API Options

### Option A: Lichess Cloud Eval
```typescript
// GET https://lichess.org/api/cloud-eval?fen={fen}&multiPv=1
// Returns: { pvs: [{ cp: 45, mate: null }] }
```
**Pros**: Free, fast, no auth
**Cons**: Rate limited

### Option B: Stockfish.js (WebAssembly)
```typescript
import Stockfish from 'stockfish.js'
const engine = new Stockfish()
// Run in browser Web Worker
```
**Pros**: No external API, unlimited
**Cons**: Resource intensive, slower

### Option C: Chess.com API
```typescript
// Similar to Lichess
```

---

## File Structure

```
app/
  lib/
    local/
      GameManager.ts          # Lichess stream fetcher
      ChessEngine.ts          # Evaluation API wrapper
      LocalBots.ts            # Bot trading logic
      MarketSimulator.ts      # Full market simulation
  components/
    LocalMarketManager.tsx    # Main orchestrator
    LocalBotPanel.tsx         # Bot status display
```

---

## Migration Path

### Phase 1: Add Local System (Parallel)
1. Create new local components
2. Add feature flag to switch between modes
3. Test locally

### Phase 2: Remove Worker
1. Delete worker code
2. Update documentation
3. Remove Stockfish dependency

### Phase 3: Optimize
1. Add caching
2. Optimize API calls
3. Add offline support

---

## Benefits

✅ **No Backend**: Everything runs in browser
✅ **Simpler Setup**: No worker process to manage
✅ **Better UX**: Instant updates, no polling lag
✅ **Easier Development**: No separate processes
✅ **More Accessible**: Works anywhere, no server needed

---

## Challenges

⚠️ **Rate Limits**: External APIs have limits
⚠️ **Performance**: Browser evaluations slower than server
⚠️ **Bot Authenticity**: Local bots less "real"
⚠️ **CORS**: May need proxy for some APIs

---

## Recommendations

**Best Approach**: Stockfish.js in Web Worker
- No external dependencies
- No rate limits
- Fast enough for this use case
- Can run multiple instances

**Fallback**: Lichess Cloud Eval with caching
- Use when Stockfish.js unavailable
- Cache aggressively to avoid rate limits

---

Next: Implement?

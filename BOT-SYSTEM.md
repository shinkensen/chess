# Bot Trading System Documentation

## Overview

The BetChess application now includes an automated bot trading system that provides market liquidity and creates a more dynamic trading environment. Two types of bots actively trade in the market:

1. **Random Bot** - Trades with weighted random probabilities
2. **Engine Bot** - Trades based on chess position evaluation

## Bot Types

### 1. Random Bot 🎲

**ID**: `11111111-1111-1111-1111-111111111111`

**Trading Strategy**:
- Trades every 10 seconds
- 70% chance to BUY, 30% chance to SELL
- Weighted probabilities for outcomes:
  - **40%** White
  - **40%** Black
  - **20%** Draw

**Trade Sizes**:
- Minimum: 5 shares
- Maximum: 50 shares
- Randomly selected within range

**Behavior**:
- Provides consistent market liquidity
- Creates natural price movements
- Simulates uninformed retail traders
- When selling, sells 20-50% of random position

**Starting Balance**: 999,999 coins (unlimited for market making)

### 2. Engine Bot 🧠

**ID**: `22222222-2222-2222-2222-222222222222`

**Trading Strategy**:
- Trades every 15 seconds
- Uses chess position evaluation to make informed trades
- Analyzes material balance and position strength

**Evaluation System**:
```
Score > +300cp  → Buy White (high confidence)
Score < -300cp  → Buy Black (high confidence)
|Score| < 50cp  → Buy Draw (equal position)
Otherwise       → Buy slightly favored side
```

**Trade Sizes**:
- Minimum: 10 shares
- Maximum: 100 shares
- Larger than Random Bot for more impact

**Confidence-Based Trading**:
- **High confidence (>0.6)** + **Low price (<2.0)** → BUY target outcome
- **Low confidence** → SELL wrong positions (30% of holdings)
- Mate detected → 95% confidence in winning side

**Position Evaluation**:
- Uses simple material-based evaluation (fast and reliable)
- Piece values: Pawn=1, Knight/Bishop=3, Rook=5, Queen=9
- Converts to centipawns (×100)
- No external API dependencies
- Can be extended to use Chess.com API or Stockfish

**Starting Balance**: 999,999 coins (unlimited for market making)

## Bot Manager

### Lifecycle Management

The `BotManager` class coordinates both bots:

```typescript
const botManager = new BotManager();

// Start bots for a game
botManager.startBots(gameId, getCurrentFen);

// Stop bots (e.g., when game ends)
botManager.stopBots();
```

### Integration Points

1. **Game Start**: Bots automatically start when a new game is detected
2. **Position Updates**: Current FEN is tracked via ref for Engine Bot evaluation
3. **Game End**: Bots stop when game completes or new game starts
4. **Cleanup**: All intervals cleared on component unmount

## Market Impact

### Liquidity Provision

Bots ensure:
- Continuous trading activity
- Price discovery mechanism
- Immediate counterparties for user trades
- Natural market volatility

### Price Dynamics

**Random Bot Effects**:
- Creates baseline trading volume
- Adds noise to market prices
- Prevents illiquid markets
- Simulates uninformed flow

**Engine Bot Effects**:
- Adds informed trading signals
- Creates correlation with position strength
- Rewards accurate position evaluation
- Provides "smart money" flow

### Market Balance

The 40:40:20 split for Random Bot matches typical chess outcomes:
- White slight advantage (~40-45% wins)
- Black slight disadvantage (~40-45% wins)  
- Draws less common (~10-20%)

## Technical Implementation

### File Structure

```
utils/
├── bot-trading.ts       # Bot implementation
├── trading-utils.ts     # Trading functions
├── game-utils.ts        # Game management
└── supabase-utils.ts    # Database client
```

### Key Classes

#### RandomBot
```typescript
class RandomBot {
  private readonly playerId = RANDOM_BOT_ID;
  private readonly tradingInterval = 10000;
  
  async executeTrade(gameId: string): Promise<void>
  private async executeBuy(gameId: string, balance: number): Promise<void>
  private async executeSell(gameId: string): Promise<void>
  startTrading(gameId: string): NodeJS.Timeout
}
```

#### EngineBot
```typescript
class EngineBot {
  private readonly playerId = ENGINE_BOT_ID;
  private readonly tradingInterval = 15000;
  
  async executeTrade(gameId: string, currentFen: string): Promise<void>
  private async evaluatePosition(fen: string): Promise<EngineEvaluation | null>
  private simpleEvaluation(fen: string): EngineEvaluation
  private async tradeBasedOnEvaluation(...): Promise<void>
  startTrading(gameId: string, getCurrentFen: () => string): NodeJS.Timeout
}
```

#### BotManager
```typescript
class BotManager {
  private randomBot: RandomBot;
  private engineBot: EngineBot;
  private intervals: NodeJS.Timeout[];
  
  startBots(gameId: string, getCurrentFen: () => string): void
  stopBots(): void
}
```

## Database Schema

Bot players are pre-seeded in the database:

```sql
INSERT INTO players (id, user_id, name, balance, is_bot)
VALUES 
  ('00000000-0000-0000-0000-000000000000', '...', 'House', 999999, true),
  ('11111111-1111-1111-1111-111111111111', '...', 'Random Bot', 999999, true),
  ('22222222-2222-2222-2222-222222222222', '...', 'Engine Bot', 999999, true);
```

## Monitoring & Debugging

### Console Logs

Bots log their activities:
```
✓ Bot manager initialized
✓ Bots started for game: {gameId}
✓ Random bot bought 25 white shares
✓ Engine bot bought 50 black shares (eval: -450cp, confidence: 0.75)
✓ Engine bot sold 15 white shares (favoring black)
✓ All bots stopped
```

### UI Indicator

Visual indicator shows bot activity:
- 🟢 Green pulsing dots
- Bot names displayed
- "2 BOTS" counter
- Shows when game is active

## Future Enhancements

### Potential Improvements

1. **Advanced Engine Integration**
   - Integrate real Lichess Cloud Eval API
   - Use Stockfish locally via WebAssembly
   - Implement deeper analysis (tactics, endgame evaluation)

2. **More Bot Types**
   - Momentum trader (follows price trends)
   - Contrarian trader (fades the crowd)
   - Value trader (buys underpriced outcomes)
   - Scalper (quick small trades)

3. **Adaptive Behavior**
   - Adjust trading frequency based on volatility
   - Scale position sizes with confidence
   - Learn from past game outcomes

4. **Risk Management**
   - Portfolio limits per outcome
   - Stop-loss mechanisms
   - Position concentration limits

5. **Performance Tracking**
   - Win rate statistics
   - Profit/loss tracking
   - Sharpe ratio calculation
   - Trade history analysis

## Configuration

### Adjustable Parameters

In `utils/bot-trading.ts`:

```typescript
// Random Bot
tradingInterval: 10000       // Time between trades (ms)
minTradeAmount: 5            // Minimum shares per trade
maxTradeAmount: 50           // Maximum shares per trade

// Engine Bot  
tradingInterval: 15000       // Time between trades (ms)
minTradeAmount: 10           // Minimum shares per trade
maxTradeAmount: 100          // Maximum shares per trade
evaluationDepth: 15          // Stockfish search depth
```

### Probability Adjustments

To change Random Bot probabilities, modify in `executeBuy()`:

```typescript
// Current: 40% white, 40% black, 20% draw
if (rand < 0.4) {
  outcome = 'white';
} else if (rand < 0.8) {  // 0.4 + 0.4 = 0.8
  outcome = 'black';
} else {
  outcome = 'draw';
}
```

## Troubleshooting

### Bots Not Trading

**Check**:
1. Bot players exist in database
2. Bots have sufficient balance
3. Current game is set
4. Console shows bot start messages

### Evaluation Errors

**Issues**:
- FEN parsing errors
- API timeouts
- Invalid positions

**Solution**:
- Falls back to simple evaluation
- Logs errors to console
- Continues trading with heuristics

### Performance Issues

**Symptoms**:
- Slow response times
- Database timeout errors
- High CPU usage

**Solutions**:
- Increase trading intervals
- Reduce bot trade sizes
- Optimize database queries
- Add connection pooling

## Best Practices

1. **Always stop bots** when component unmounts
2. **Use ref for FEN** to avoid stale closures
3. **Handle errors gracefully** to prevent bot crashes
4. **Log bot activity** for debugging
5. **Monitor bot balances** to ensure liquidity
6. **Test with different** game scenarios
7. **Profile performance** under load

## Summary

The bot trading system creates a realistic, liquid market for the chess prediction game. Random Bot provides consistent baseline activity, while Engine Bot adds intelligent trading signals based on position evaluation. Together, they ensure users always have counterparties for their trades and experience dynamic, evolving market prices that reflect the actual game state.

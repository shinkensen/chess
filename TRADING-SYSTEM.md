# BetChess Trading System

## Overview

The BetChess trading system transforms the app from simple fixed betting into a **live trading market** where users can buy and sell shares of game outcomes (White, Black, Draw) at dynamic prices that update in real-time.

## Key Concepts

### 1. **Shares vs Bets**
- **Old System**: Place a fixed bet, wait for game to end
- **New System**: Buy/sell shares continuously during the game at market prices

### 2. **Dynamic Pricing**
Prices adjust based on market demand:
- More people buying White → White share price increases
- Fewer people interested in Draw → Draw share price decreases
- Prices update every 2 seconds

### 3. **Positions**
Your "position" is your current holdings:
- **Shares Owned**: How many shares you hold
- **Average Cost**: Your average purchase price
- **Current Value**: Shares × Current Price
- **Profit/Loss**: (Current Price - Avg Cost) × Shares

## Database Schema

### Tables

**positions** - Tracks share ownership
```sql
- player_id: Who owns the shares
- game_id: Which game
- outcome: 'white', 'black', or 'draw'
- shares: Number of shares owned
- avg_cost: Average cost per share
```

**transactions** - Historical record
```sql
- player_id, game_id, outcome
- transaction_type: 'buy' or 'sell'
- shares: Number traded
- price_per_share: Price at time of trade
- total_cost: Total transaction value
```

### Pricing Function

```sql
get_share_price(game_id, outcome) → price
```

Calculates dynamic price based on:
- Total shares in market
- Distribution across outcomes
- Supply/demand dynamics

## Trading Flow

### Buying Shares
1. Select outcome (White/Black/Draw)
2. Enter number of shares
3. See total cost at current price
4. Click BUY
5. Balance deducted, position created/updated
6. Transaction recorded

### Selling Shares
1. Must own shares of selected outcome
2. Enter number to sell (≤ shares owned)
3. See total proceeds at current price
4. Click SELL
5. Balance credited, position updated
6. Transaction recorded

### Game Settlement
When game ends:
1. Determine winner
2. Calculate total pool from all positions
3. Take 5% commission
4. Pay winners proportionally
5. Losers lose their investment
6. Clear all positions

## Setup Instructions

### 1. Run Database Migration
Execute `supabase-schema-trading.sql` in Supabase SQL Editor:
```bash
# This creates:
# - positions table
# - transactions table  
# - House and bot players
# - Pricing function
# - RLS policies
```

### 2. Seed Initial Market
Each new game needs seed positions to establish initial prices:
- House player creates baseline positions
- This prevents division by zero
- Provides initial liquidity

### 3. Update Components
Replace BettingPanel with TradingPanel in main app

## API Functions

### Core Functions (`utils/trading-utils.ts`)

```typescript
// Get current prices
getMarketPrices(gameId) → { white, black, draw }

// Get player's positions
getPlayerPositions(playerId, gameId) → Position[]

// Buy shares
buyShares(playerId, gameId, outcome, shares) 
  → { success, error? }

// Sell shares
sellShares(playerId, gameId, outcome, shares)
  → { success, error? }

// Calculate portfolio value
calculatePortfolioValue(positions, gameId) 
  → totalValue

// Settle game and pay winners
settleGame(gameId, winner) → void
```

## UI Components

### TradingPanel
- Buy/Sell toggle
- Outcome selection (White/Black/Draw)
- Live price display (updates every 2s)
- Share quantity input
- Current position display
- P/L calculation
- Portfolio summary

### ProbabilityChart  
- Shows market distribution over time
- Visualizes price movements
- Helps identify trading opportunities

## Advantages Over Simple Betting

### For Players
- **Flexibility**: Can enter/exit positions anytime
- **Strategy**: Buy low, sell high
- **Risk Management**: Cut losses early
- **Arbitrage**: Exploit price inefficiencies

### For Platform
- **Higher Engagement**: Continuous interaction
- **More Transactions**: Multiple trades per game
- **Market Efficiency**: Prices reflect true odds
- **Commission**: 5% on settlements

## Trading Strategies

### Momentum Trading
- Buy outcome when price is rising
- Sell when momentum slows
- Ride the trend

### Contrarian Trading
- Buy unpopular outcomes when oversold
- Sell popular outcomes when overbought
- Profit from mean reversion

### Position Trading
- Buy early, hold through game
- Less active than day trading
- Focus on fundamentals

### Scalping
- Many small trades
- Profit from tiny price movements
- High frequency, low margin

## Example Scenario

**Game Start**
- All prices at $1.00
- House seeds 100 White, 100 Black, 20 Draw

**Early Game (White Advantage)**
- Players buy White shares
- White price → $1.50
- Black price → $0.80
- Smart players buy Black (cheap)

**Mid Game (Black Counter-Attack)**
- Black starts winning
- Panic selling of White
- White price → $1.10
- Black price → $1.30
- Early Black buyers profit

**End Game**
- White wins!
- White shareholders get payout
- Black/Draw shareholders lose investment

## Technical Details

### Price Calculation
```
base_price = 1.00
adjustment = (total_shares - outcome_shares) / (total_shares + 100)
final_price = base_price + adjustment
clamped_price = between 0.10 and 10.00
```

### Settlement Distribution
```
total_pool = sum of all position values
commission = 5%
payout_pool = total_pool × 0.95
winner_share = (your_position_value / winning_pool) × payout_pool
```

### Performance
- Price updates: Every 2 seconds
- Position refresh: After each trade
- Transaction history: Last 20 trades
- Database queries: Optimized with indexes

## Future Enhancements

- **Order Book**: Limit orders, stop losses
- **Margin Trading**: Leverage positions
- **Options**: Calls and puts on outcomes
- **Social Features**: Follow top traders
- **Analytics**: Charts, indicators, signals
- **Mobile App**: Native iOS/Android
- **API**: Public trading API

## Troubleshooting

**"Insufficient balance"**
- Check your cash balance
- Sell existing positions for liquidity

**"Insufficient shares"**
- Can't sell more than you own
- Check your position size

**"Price changed"**
- Market moved during trade
- Retry at new price

**Prices not updating**
- Check network connection
- Verify database function exists
- Ensure RLS policies allow access

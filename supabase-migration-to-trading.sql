-- MIGRATION SCRIPT: From Simple Betting to Trading System
-- Run this if you already have existing tables

-- Step 1: Add is_bot column to existing players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE;

-- Step 2: Temporarily drop the foreign key constraint
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_user_id_fkey;

-- Step 3: Make user_id nullable temporarily for bot players
ALTER TABLE players ALTER COLUMN user_id DROP NOT NULL;

-- Step 4: Insert bot players if they don't exist
INSERT INTO players (id, user_id, name, balance, is_bot)
VALUES 
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'House', 999999, true),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Random Bot', 999999, true),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Engine Bot', 999999, true)
ON CONFLICT (id) DO UPDATE SET is_bot = true, balance = 999999;

-- Step 5: Re-add foreign key constraint (only for non-bot players)
-- This allows bots to have fake user_ids while real players still require valid auth.users references
ALTER TABLE players ADD CONSTRAINT players_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE 
  NOT VALID;

-- Step 3: Add channel column to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'best';

-- Step 4: Drop old bets table if it exists (WARNING: This deletes bet history!)
-- Comment out if you want to keep old data
DROP TABLE IF EXISTS bets CASCADE;

-- Step 5: Create positions table
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('white', 'black', 'draw')),
  shares INTEGER NOT NULL DEFAULT 0,
  avg_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, game_id, outcome)
);

-- Step 6: Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('white', 'black', 'draw')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  shares INTEGER NOT NULL,
  price_per_share DECIMAL(10, 2) NOT NULL,
  total_cost INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 7: Enable RLS on new tables
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies for positions
DROP POLICY IF EXISTS "Users can view their own positions" ON positions;
CREATE POLICY "Users can view their own positions"
  ON positions FOR SELECT
  USING (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their positions" ON positions;
CREATE POLICY "Users can manage their positions"
  ON positions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Step 9: Create RLS policies for transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create transactions" ON transactions;
CREATE POLICY "Users can create transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Step 10: Create pricing function
CREATE OR REPLACE FUNCTION get_share_price(p_game_id UUID, p_outcome TEXT)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  white_shares INTEGER;
  black_shares INTEGER;
  draw_shares INTEGER;
  total_shares INTEGER;
  outcome_shares INTEGER;
  price DECIMAL(10, 2);
BEGIN
  -- Count total shares for each outcome
  SELECT 
    COALESCE(SUM(CASE WHEN outcome = 'white' THEN shares ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN outcome = 'black' THEN shares ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN outcome = 'draw' THEN shares ELSE 0 END), 0)
  INTO white_shares, black_shares, draw_shares
  FROM positions
  WHERE game_id = p_game_id;
  
  total_shares := white_shares + black_shares + draw_shares;
  
  -- Get shares for requested outcome
  IF p_outcome = 'white' THEN
    outcome_shares := white_shares;
  ELSIF p_outcome = 'black' THEN
    outcome_shares := black_shares;
  ELSE
    outcome_shares := draw_shares;
  END IF;
  
  -- Calculate price based on market share (more popular = higher price)
  IF total_shares = 0 THEN
    price := 1.00;
  ELSE
    -- Price inversely proportional to popularity
    price := 1.00 + (total_shares - outcome_shares)::DECIMAL / (total_shares + 100);
  END IF;
  
  RETURN GREATEST(0.10, LEAST(price, 10.00));
END;
$$ LANGUAGE plpgsql;

-- Step 11: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_positions_game_player ON positions(game_id, player_id);
CREATE INDEX IF NOT EXISTS idx_transactions_game ON transactions(game_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_channel ON games(channel, status);

-- Step 12: Update existing players RLS policy to show bots
DROP POLICY IF EXISTS "Users can view their own player data" ON players;
CREATE POLICY "Users can view their own player data"
  ON players FOR SELECT
  USING (auth.uid() = user_id OR is_bot = true);

-- Migration complete!
-- You can now use the trading system

-- TRADING SCHEMA - Allows buying and selling shares during game
-- This replaces the simple betting system with a dynamic trading market

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  name TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 500,
  is_bot BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert house player and bots
INSERT INTO players (id, user_id, name, balance, is_bot)
VALUES 
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'House', 999999, true),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Random Bot', 999999, true),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Engine Bot', 999999, true)
ON CONFLICT (id) DO NOTHING;

-- Create games table with channel support
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lichess_game_id TEXT UNIQUE NOT NULL,
  channel TEXT NOT NULL DEFAULT 'best', -- 'best', 'blitz', 'rapid', 'classical', 'bullet'
  start_fen TEXT NOT NULL,
  current_fen TEXT,
  status TEXT NOT NULL DEFAULT 'ongoing',
  winner TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create positions table (replaces bets) - tracks share ownership
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('white', 'black', 'draw')),
  shares INTEGER NOT NULL DEFAULT 0, -- Number of shares owned
  avg_cost DECIMAL(10, 2) NOT NULL DEFAULT 0, -- Average cost per share
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, game_id, outcome)
);

-- Create transactions table - tracks all buy/sell activity
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

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policies for players table
DROP POLICY IF EXISTS "Users can view their own player data" ON players;
CREATE POLICY "Users can view their own player data"
  ON players FOR SELECT
  USING (auth.uid() = user_id OR is_bot = true);

DROP POLICY IF EXISTS "Users can update their own player data" ON players;
CREATE POLICY "Users can update their own player data"
  ON players FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own player data" ON players;
CREATE POLICY "Users can insert their own player data"
  ON players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies for games table
DROP POLICY IF EXISTS "Anyone can view games" ON games;
CREATE POLICY "Anyone can view games"
  ON games FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert games" ON games;
CREATE POLICY "Anyone can insert games"
  ON games FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update games" ON games;
CREATE POLICY "Anyone can update games"
  ON games FOR UPDATE
  TO authenticated
  USING (true);

-- Policies for positions table
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

-- Policies for transactions table
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create transactions" ON transactions;
CREATE POLICY "Users can create transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to calculate current share price for an outcome
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
  -- Base price is 1.00, scales based on proportion
  IF total_shares = 0 THEN
    price := 1.00;
  ELSE
    -- Price inversely proportional to popularity
    price := 1.00 + (total_shares - outcome_shares)::DECIMAL / (total_shares + 100);
  END IF;
  
  RETURN GREATEST(0.10, LEAST(price, 10.00)); -- Clamp between 0.10 and 10.00
END;
$$ LANGUAGE plpgsql;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_positions_game_player ON positions(game_id, player_id);
CREATE INDEX IF NOT EXISTS idx_transactions_game ON transactions(game_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_channel ON games(channel, status);

-- SIMPLIFIED SCHEMA (Run this if the trigger version doesn't work)
-- This version doesn't use auth.users triggers

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  name TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert house player for seed bets (won't affect balances)
INSERT INTO players (id, user_id, name, balance)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'House', 999999)
ON CONFLICT (id) DO NOTHING;

-- Create games table to track game sessions
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lichess_game_id TEXT UNIQUE NOT NULL,
  start_fen TEXT NOT NULL,
  current_fen TEXT,
  status TEXT NOT NULL DEFAULT 'ongoing',
  winner TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create bets table
CREATE TABLE IF NOT EXISTS bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  bet_amount INTEGER NOT NULL CHECK (bet_amount > 0),
  bet_on TEXT NOT NULL CHECK (bet_on IN ('white', 'black', 'draw')),
  result TEXT,
  payout INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, game_id)
);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;

-- Policies for players table (more permissive for manual creation)
DROP POLICY IF EXISTS "Users can view their own player data" ON players;
CREATE POLICY "Users can view their own player data"
  ON players FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own player data" ON players;
CREATE POLICY "Users can update their own player data"
  ON players FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own player data" ON players;
CREATE POLICY "Users can insert their own player data"
  ON players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies for games table (public read)
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

-- Policies for bets table
DROP POLICY IF EXISTS "Users can view their own bets" ON bets;
CREATE POLICY "Users can view their own bets"
  ON bets FOR SELECT
  USING (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create their own bets" ON bets;
CREATE POLICY "Users can create their own bets"
  ON bets FOR INSERT
  WITH CHECK (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "System can update bets" ON bets;
CREATE POLICY "System can update bets"
  ON bets FOR UPDATE
  TO authenticated
  USING (true);

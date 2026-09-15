-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  name TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create games table to track game sessions
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lichess_game_id TEXT UNIQUE NOT NULL,
  start_fen TEXT NOT NULL,
  current_fen TEXT,
  status TEXT NOT NULL DEFAULT 'ongoing', -- 'ongoing', 'completed'
  winner TEXT, -- 'white', 'black', 'draw', null
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
  result TEXT, -- 'won', 'lost', 'push' (for draw when betting on draw)
  payout INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, game_id)
);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;

-- Policies for players table
CREATE POLICY "Users can view their own player data"
  ON players FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own player data"
  ON players FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own player data"
  ON players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies for games table (public read)
CREATE POLICY "Anyone can view games"
  ON games FOR SELECT
  TO authenticated
  USING (true);

-- Policies for bets table
CREATE POLICY "Users can view their own bets"
  ON bets FOR SELECT
  USING (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()));

CREATE POLICY "Users can create their own bets"
  ON bets FOR INSERT
  WITH CHECK (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()));

-- Function to update player balance after bet result
CREATE OR REPLACE FUNCTION update_player_balance_on_bet_result()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.result IS NOT NULL AND OLD.result IS NULL THEN
    UPDATE players
    SET balance = balance + NEW.payout - NEW.bet_amount
    WHERE id = NEW.player_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update balance
CREATE TRIGGER bet_result_trigger
AFTER UPDATE ON bets
FOR EACH ROW
EXECUTE FUNCTION update_player_balance_on_bet_result();

-- Function to automatically create player on signup
CREATE OR REPLACE FUNCTION create_player_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO players (user_id, name, balance)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), 500);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create player when user signs up
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_player_on_signup();

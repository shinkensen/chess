-- Fix RLS policies to allow bot trading
-- Run this in your Supabase SQL editor

-- Update positions policies to allow viewing bot positions
DROP POLICY IF EXISTS "Users can view their own positions" ON positions;
CREATE POLICY "Users can view their own positions"
  ON positions FOR SELECT
  TO authenticated
  USING (
    player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
    OR
    player_id IN (SELECT id FROM players WHERE is_bot = true)
  );

DROP POLICY IF EXISTS "Users can manage their positions" ON positions;
DROP POLICY IF EXISTS "Users can manage positions" ON positions;
CREATE POLICY "Users can manage positions"
  ON positions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update transactions policies to allow viewing bot transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view transactions" ON transactions;
CREATE POLICY "Users can view transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
    OR
    player_id IN (SELECT id FROM players WHERE is_bot = true)
  );

DROP POLICY IF EXISTS "Users can create transactions" ON transactions;
CREATE POLICY "Users can create transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure authenticated users can view bot players
DROP POLICY IF EXISTS "Users can view their own player data" ON players;
DROP POLICY IF EXISTS "Users can view player data" ON players;
CREATE POLICY "Users can view player data"
  ON players FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_bot = true);

-- Fix games table policies to allow proper queries
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
  USING (true)
  WITH CHECK (true);

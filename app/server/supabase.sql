-- ============================================================================
-- Chess betting app — schema & RPCs matching the project's actual tables.
-- Run this in your Supabase SQL editor. Idempotent for tables; replaces RPCs.
-- ============================================================================

-- ---- users table --------------------------------------------------------
-- One row per auth user, created on signup with 500 starting gold.
create table if not exists public.users (
  "userId" uuid primary key references auth.users(id) on delete cascade,
  email    text,
  gold     integer not null default 500
);

-- ---- games table (matches existing schema exactly) ----------------------
-- gameId         uuid
-- moves          text   (comma-separated list of "r1c1r2c2" moves; '' = none)
-- mostRecentMove text
-- turnToPlay     text   'white' | 'black'
-- player1        jsonb  {player,color,bet}
-- player2        jsonb
-- pool           int8
create table if not exists public.games (
  "gameId"          uuid primary key default gen_random_uuid(),
  "player1"         jsonb not null,
  "player2"         jsonb,
  moves             text not null default '',
  "mostRecentMove"  text,
  "turnToPlay"      text not null default 'white',
  pool              bigint not null default 0,
  status            text not null default 'open'
);

alter table public.games enable row level security;
alter table public.users enable row level security;

drop policy if exists "public read games" on public.games;
create policy "public read games" on public.games
  for select using (true);

drop policy if exists "users read own" on public.users;
create policy "users read own" on public.users
  for select using (auth.uid() = "userId");

drop policy if exists "users update own gold" on public.users;
create policy "users update own gold" on public.users
  for update using (auth.uid() = "userId");

drop policy if exists "users insert own" on public.users;
create policy "users insert own" on public.users
  for insert with check (auth.uid() = "userId");

-- ============================================================================
-- RPCs
-- ============================================================================

-- create_game(p_bet) -> gameId (uuid)
create or replace function public.create_game(p_bet integer)
returns uuid as $$
declare
  v_uid   text := auth.uid()::text;
  v_color text;
  v_row   public.games;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_bet <= 0 then raise exception 'bet must be positive'; end if;
  if (select gold from public.users where "userId" = v_uid::uuid) < p_bet then
    raise exception 'not enough gold';
  end if;

  update public.users set gold = gold - p_bet where "userId" = v_uid::uuid;
  v_color := case when random() < 0.5 then 'white' else 'black' end;

  insert into public.games ("player1", pool)
  values (
    jsonb_build_object('player', v_uid, 'color', v_color, 'bet', p_bet),
    p_bet
  )
  returning * into v_row;

  return v_row."gameId";
end;
$$ language plpgsql security definer;

-- join_game(p_game_id uuid, p_bet integer) -> boolean
create or replace function public.join_game(p_game_id uuid, p_bet integer)
returns boolean as $$
declare
  v_uid  text := auth.uid()::text;
  v_game public.games;
  v_p1   jsonb;
  v_min  integer;
  v_pool integer;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_bet <= 0 then raise exception 'bet must be positive'; end if;

  select * into v_game from public.games where "gameId" = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'open' then raise exception 'game is not open'; end if;
  if v_game."player2" is not null then raise exception 'game is full'; end if;

  v_p1 := v_game."player1";
  if (v_p1->>'player') = v_uid then raise exception 'cannot join your own game'; end if;

  if (select gold from public.users where "userId" = v_uid::uuid) < p_bet then
    raise exception 'not enough gold';
  end if;

  v_min := least((v_p1->>'bet')::integer, p_bet);
  v_pool := v_min * 2;

  update public.users set gold = gold - p_bet where "userId" = v_uid::uuid;
  if (v_p1->>'bet')::integer > v_min then
    update public.users
      set gold = gold + ((v_p1->>'bet')::integer - v_min)
      where "userId" = (v_p1->>'player')::uuid;
  elsif p_bet > v_min then
    update public.users set gold = gold + (p_bet - v_min) where "userId" = v_uid::uuid;
  end if;

  update public.games set
    "player2"   = jsonb_build_object(
      'player', v_uid,
      'color', case when (v_p1->>'color') = 'white' then 'black' else 'white' end,
      'bet', v_min
    ),
    pool        = v_pool,
    status      = 'active',
    "turnToPlay"= 'white'
  where "gameId" = p_game_id;

  return true;
end;
$$ language plpgsql security definer;

-- submit_move(p_game_id uuid, p_move text, p_next_turn text)
-- Appends p_move to the comma-separated moves text.
create or replace function public.submit_move(p_game_id uuid, p_move text, p_next_turn text)
returns void as $$
declare
  v_existing text;
begin
  select moves into v_existing from public.games where "gameId" = p_game_id;
  if not found then return; end if;
  update public.games
  set moves = case
                when v_existing = '' or v_existing is null then p_move
                else v_existing || ',' || p_move
              end,
      "mostRecentMove" = p_move,
      "turnToPlay" = p_next_turn
  where "gameId" = p_game_id;
end;
$$ language plpgsql security definer;

-- finish_game(p_game_id uuid, p_result text)
create or replace function public.finish_game(p_game_id uuid, p_result text)
returns void as $$
declare
  v_game public.games;
  v_p1   jsonb;
  v_p2   jsonb;
begin
  select * into v_game from public.games where "gameId" = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'active' then return; end if;

  v_p1 := v_game."player1";
  v_p2 := v_game."player2";
  update public.games set status = p_result where "gameId" = p_game_id;

  if p_result = 'white_win' then
    if (v_p1->>'color') = 'white' then
      update public.users set gold = gold + v_game.pool where "userId" = (v_p1->>'player')::uuid;
    else
      update public.users set gold = gold + v_game.pool where "userId" = (v_p2->>'player')::uuid;
    end if;
  elsif p_result = 'black_win' then
    if (v_p1->>'color') = 'black' then
      update public.users set gold = gold + v_game.pool where "userId" = (v_p1->>'player')::uuid;
    else
      update public.users set gold = gold + v_game.pool where "userId" = (v_p2->>'player')::uuid;
    end if;
  else
    update public.users set gold = gold + (v_game.pool / 2) where "userId" = (v_p1->>'player')::uuid;
    update public.users set gold = gold + (v_game.pool / 2) where "userId" = (v_p2->>'player')::uuid;
  end if;
end;
$$ language plpgsql security definer;

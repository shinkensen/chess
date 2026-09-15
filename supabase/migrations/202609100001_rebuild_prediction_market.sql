begin;

create extension if not exists pgcrypto;

-- This migration replaces the empty legacy prototype schema. These tables used
-- incompatible client-mutated balances, positions, and parimutuel transactions.
drop table if exists public.transactions cascade;
drop table if exists public.positions cascade;
drop table if exists public.games cascade;
drop table if exists public.players cascade;

create type public.market_status as enum ('scheduled', 'open', 'suspended', 'closed', 'settled', 'cancelled');
create type public.market_outcome as enum ('white', 'draw', 'black');
create type public.trade_side as enum ('buy', 'sell');
create type public.ledger_kind as enum ('initial_grant', 'trade', 'settlement', 'refund', 'adjustment');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 32),
  is_bot boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.wallets (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  balance_cents bigint not null default 1000000 check (balance_cents >= 0),
  updated_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  lichess_game_id text not null unique,
  source text not null default 'featured',
  white_name text not null,
  black_name text not null,
  white_rating integer,
  black_rating integer,
  initial_fen text not null default 'startpos',
  current_fen text,
  last_move text,
  move_count integer not null default 0 check (move_count >= 0),
  white_clock_ms integer,
  black_clock_ms integer,
  status text not null default 'created',
  winner public.market_outcome,
  started_at timestamptz,
  completed_at timestamptz,
  last_event_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null unique references public.games(id) on delete cascade,
  status public.market_status not null default 'scheduled',
  liquidity_b numeric(20, 8) not null default 250000 check (liquidity_b > 0),
  white_q bigint not null default 0,
  draw_q bigint not null default 0,
  black_q bigint not null default 0,
  volume_cents bigint not null default 0,
  settled_outcome public.market_outcome,
  opened_at timestamptz,
  closed_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.positions (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  outcome public.market_outcome not null,
  shares_milli bigint not null default 0 check (shares_milli >= 0),
  cost_basis_cents bigint not null default 0 check (cost_basis_cents >= 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, market_id, outcome)
);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null,
  profile_id uuid not null references public.profiles(id),
  market_id uuid not null references public.markets(id),
  outcome public.market_outcome not null,
  side public.trade_side not null,
  shares_milli bigint not null check (shares_milli > 0),
  total_cents bigint not null check (total_cents >= 0),
  avg_price numeric(12, 8) not null,
  prices_before jsonb not null,
  prices_after jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (profile_id, idempotency_key)
);

create table public.price_snapshots (
  id bigint generated always as identity primary key,
  market_id uuid not null references public.markets(id) on delete cascade,
  move_count integer not null default 0,
  white_price numeric(12, 8) not null,
  draw_price numeric(12, 8) not null,
  black_price numeric(12, 8) not null,
  created_at timestamptz not null default now()
);

create table public.wallet_ledger (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null,
  balance_after_cents bigint not null check (balance_after_cents >= 0),
  kind public.ledger_kind not null,
  reference_id uuid,
  description text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, kind, reference_id)
);

create table public.worker_leases (
  name text primary key,
  holder_id uuid not null,
  lease_until timestamptz not null,
  heartbeat_at timestamptz not null default now()
);

create table public.ingestion_events (
  source text not null,
  event_id text not null,
  game_id uuid references public.games(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (source, event_id)
);

create index markets_status_idx on public.markets(status);
create index games_status_idx on public.games(status, last_event_at desc);
create index trades_market_created_idx on public.trades(market_id, created_at desc);
create index snapshots_market_created_idx on public.price_snapshots(market_id, created_at);
create index ledger_profile_created_idx on public.wallet_ledger(profile_id, created_at desc);

create or replace function public.market_prices(p_white_q bigint, p_draw_q bigint, p_black_q bigint, p_b numeric)
returns jsonb language sql immutable strict set search_path = '' as $$
  with x as (
    select p_white_q::numeric / p_b as w,
           p_draw_q::numeric / p_b as d,
           p_black_q::numeric / p_b as bl
  ), stabilized as (
    select w, d, bl, greatest(w, d, bl) as m from x
  ), weights as (
    select exp(w-m) as w, exp(d-m) as d, exp(bl-m) as bl from stabilized
  )
  select jsonb_build_object(
    'white', w/(w+d+bl),
    'draw', d/(w+d+bl),
    'black', bl/(w+d+bl)
  ) from weights;
$$;

create or replace function public.lmsr_cost(p_white_q bigint, p_draw_q bigint, p_black_q bigint, p_b numeric)
returns numeric language sql immutable strict set search_path = '' as $$
  with x as (
    select p_white_q::numeric / p_b as w,
           p_draw_q::numeric / p_b as d,
           p_black_q::numeric / p_b as bl
  ), stabilized as (
    select w, d, bl, greatest(w, d, bl) as m from x
  )
  select p_b * (m + ln(exp(w-m) + exp(d-m) + exp(bl-m))) from stabilized;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  v_name := left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'Player'), 32);
  insert into public.profiles(id, display_name) values (new.id, v_name) on conflict do nothing;
  insert into public.wallets(profile_id, balance_cents) values (new.id, 1000000) on conflict do nothing;
  insert into public.wallet_ledger(profile_id, amount_cents, balance_after_cents, kind, reference_id, description)
  values (new.id, 1000000, 1000000, 'initial_grant', new.id, 'Welcome grant · no cash value')
  on conflict (profile_id, kind, reference_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.quote_trade(
  p_market_id uuid,
  p_outcome public.market_outcome,
  p_side public.trade_side,
  p_shares_milli bigint
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  m public.markets%rowtype;
  v_delta bigint;
  v_before numeric;
  v_after numeric;
  v_total bigint;
  v_prices_before jsonb;
  v_prices_after jsonb;
begin
  if p_shares_milli <= 0 or p_shares_milli > 1000000 then raise exception 'invalid_share_amount'; end if;
  select * into m from public.markets where id = p_market_id;
  if not found then raise exception 'market_not_found'; end if;
  if m.status not in ('open', 'scheduled') then raise exception 'market_not_open'; end if;
  v_delta := case when p_side = 'buy' then p_shares_milli else -p_shares_milli end;
  v_prices_before := public.market_prices(m.white_q, m.draw_q, m.black_q, m.liquidity_b);
  v_before := public.lmsr_cost(m.white_q, m.draw_q, m.black_q, m.liquidity_b);
  if p_outcome = 'white' then m.white_q := m.white_q + v_delta;
  elsif p_outcome = 'draw' then m.draw_q := m.draw_q + v_delta;
  else m.black_q := m.black_q + v_delta;
  end if;
  v_after := public.lmsr_cost(m.white_q, m.draw_q, m.black_q, m.liquidity_b);
  -- LMSR inventory is measured in milli-shares. A winning share pays one
  -- credit (100 cents), so one milli-share pays 0.1 cent.
  v_total := case
    when p_side = 'buy' then ceil((v_after-v_before) / 10)
    else floor((v_before-v_after) / 10)
  end;
  v_prices_after := public.market_prices(m.white_q, m.draw_q, m.black_q, m.liquidity_b);
  return jsonb_build_object(
    'marketId', p_market_id, 'outcome', p_outcome, 'side', p_side,
    'sharesMilli', p_shares_milli, 'totalCents', greatest(v_total, 0),
    'averagePrice', greatest(v_total, 0)::numeric * 10 / p_shares_milli,
    'pricesBefore', v_prices_before, 'pricesAfter', v_prices_after
  );
end;
$$;

create or replace function public.execute_trade(
  p_market_id uuid,
  p_outcome public.market_outcome,
  p_side public.trade_side,
  p_shares_milli bigint,
  p_limit_cents bigint,
  p_idempotency_key uuid,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  m public.markets%rowtype;
  w public.wallets%rowtype;
  p public.positions%rowtype;
  q jsonb;
  v_total bigint;
  v_existing public.trades%rowtype;
  v_new_basis bigint;
  v_trade_id uuid;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_market_id::text, 0));
  select * into v_existing from public.trades where profile_id=v_user and idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('tradeId', v_existing.id, 'totalCents', v_existing.total_cents, 'duplicate', true); end if;
  select * into m from public.markets where id=p_market_id for update;
  if not found or m.status not in ('open', 'scheduled') then raise exception 'market_not_open'; end if;
  -- Allow trading on scheduled markets (prediction before first move) and started games
  -- Remove the game_not_started check to enable pre-game trading
  select * into w from public.wallets where profile_id=v_user for update;
  if not found then raise exception 'wallet_not_found'; end if;
  select * into p from public.positions where profile_id=v_user and market_id=p_market_id and outcome=p_outcome for update;
  if p_side='sell' and (not found or p.shares_milli < p_shares_milli) then raise exception 'insufficient_shares'; end if;
  q := public.quote_trade(p_market_id, p_outcome, p_side, p_shares_milli);
  v_total := (q->>'totalCents')::bigint;
  if p_side='buy' and v_total > p_limit_cents then raise exception 'slippage_limit'; end if;
  if p_side='sell' and v_total < p_limit_cents then raise exception 'slippage_limit'; end if;
  if p_side='buy' and w.balance_cents < v_total then raise exception 'insufficient_balance'; end if;

  if p_outcome='white' then update public.markets set white_q=white_q+(case when p_side='buy' then p_shares_milli else -p_shares_milli end), volume_cents=volume_cents+v_total where id=p_market_id;
  elsif p_outcome='draw' then update public.markets set draw_q=draw_q+(case when p_side='buy' then p_shares_milli else -p_shares_milli end), volume_cents=volume_cents+v_total where id=p_market_id;
  else update public.markets set black_q=black_q+(case when p_side='buy' then p_shares_milli else -p_shares_milli end), volume_cents=volume_cents+v_total where id=p_market_id; end if;

  update public.wallets set balance_cents=balance_cents+(case when p_side='buy' then -v_total else v_total end), updated_at=now() where profile_id=v_user returning * into w;
  if p_side='buy' then
    v_new_basis := coalesce(p.cost_basis_cents,0)+v_total;
    insert into public.positions(profile_id,market_id,outcome,shares_milli,cost_basis_cents)
    values(v_user,p_market_id,p_outcome,p_shares_milli,v_total)
    on conflict(profile_id,market_id,outcome) do update set shares_milli=public.positions.shares_milli+excluded.shares_milli,cost_basis_cents=public.positions.cost_basis_cents+excluded.cost_basis_cents,updated_at=now();
  else
    v_new_basis := greatest(0, p.cost_basis_cents - round(p.cost_basis_cents::numeric * p_shares_milli / p.shares_milli));
    update public.positions set shares_milli=shares_milli-p_shares_milli,cost_basis_cents=v_new_basis,updated_at=now() where profile_id=v_user and market_id=p_market_id and outcome=p_outcome;
  end if;
  insert into public.trades(idempotency_key,profile_id,market_id,outcome,side,shares_milli,total_cents,avg_price,prices_before,prices_after,metadata)
  values(p_idempotency_key,v_user,p_market_id,p_outcome,p_side,p_shares_milli,v_total,(q->>'averagePrice')::numeric,q->'pricesBefore',q->'pricesAfter',coalesce(p_metadata,'{}')) returning id into v_trade_id;
  insert into public.wallet_ledger(profile_id,amount_cents,balance_after_cents,kind,reference_id,description)
  values(v_user,case when p_side='buy' then -v_total else v_total end,w.balance_cents,'trade',v_trade_id,initcap(p_side::text)||' '||p_outcome::text||' shares');
  insert into public.price_snapshots(market_id,move_count,white_price,draw_price,black_price)
  select p_market_id,g.move_count,(q->'pricesAfter'->>'white')::numeric,(q->'pricesAfter'->>'draw')::numeric,(q->'pricesAfter'->>'black')::numeric from public.games g where g.id=m.game_id;
  return jsonb_build_object('tradeId',v_trade_id,'totalCents',v_total,'balanceCents',w.balance_cents,'quote',q,'duplicate',false);
end;
$$;

create or replace function public.settle_market(p_market_id uuid, p_outcome public.market_outcome)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m public.markets%rowtype;
  r record;
  v_payout bigint;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_market_id::text, 0));
  select * into m from public.markets where id=p_market_id for update;
  if not found then raise exception 'market_not_found'; end if;
  if m.status='settled' then return jsonb_build_object('settled',true,'duplicate',true); end if;
  if m.status not in ('open','closed','suspended') then raise exception 'market_not_settleable'; end if;
  update public.markets set status='settled',settled_outcome=p_outcome,closed_at=coalesce(closed_at,now()),settled_at=now() where id=p_market_id;
  for r in select profile_id,shares_milli from public.positions where market_id=p_market_id and outcome=p_outcome and shares_milli>0 for update loop
    v_payout := floor(r.shares_milli::numeric / 10);
    update public.wallets set balance_cents=balance_cents+v_payout,updated_at=now() where profile_id=r.profile_id;
    insert into public.wallet_ledger(profile_id,amount_cents,balance_after_cents,kind,reference_id,description)
    select r.profile_id,v_payout,balance_cents,'settlement',p_market_id,'Winning '||p_outcome::text||' shares' from public.wallets where profile_id=r.profile_id
    on conflict (profile_id, kind, reference_id) do nothing;
  end loop;
  return jsonb_build_object('settled',true,'duplicate',false,'outcome',p_outcome);
end;
$$;

create or replace function public.acquire_worker_lease(
  p_name text,
  p_holder_id uuid,
  p_lease_seconds integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_acquired boolean;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_lease_seconds < 5 or p_lease_seconds > 300 then raise exception 'invalid_lease_duration'; end if;
  insert into public.worker_leases(name, holder_id, lease_until, heartbeat_at)
  values (p_name, p_holder_id, now() + make_interval(secs => p_lease_seconds), now())
  on conflict (name) do update
    set holder_id = excluded.holder_id,
        lease_until = excluded.lease_until,
        heartbeat_at = excluded.heartbeat_at
    where public.worker_leases.holder_id = excluded.holder_id
       or public.worker_leases.lease_until <= now()
  returning true into v_acquired;
  return coalesce(v_acquired, false);
end;
$$;

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.games enable row level security;
alter table public.markets enable row level security;
alter table public.positions enable row level security;
alter table public.trades enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.worker_leases enable row level security;
alter table public.ingestion_events enable row level security;

create policy profiles_public_read on public.profiles for select using (true);
create policy wallets_owner_read on public.wallets for select using (profile_id=auth.uid());
create policy ledger_owner_read on public.wallet_ledger for select using (profile_id=auth.uid());
create policy games_public_read on public.games for select using (true);
create policy markets_public_read on public.markets for select using (true);
create policy positions_owner_read on public.positions for select using (profile_id=auth.uid());
create policy trades_public_read on public.trades for select using (true);
create policy snapshots_public_read on public.price_snapshots for select using (true);

revoke all on public.wallets, public.wallet_ledger, public.games, public.markets, public.positions, public.trades, public.price_snapshots, public.worker_leases, public.ingestion_events from anon, authenticated;
grant select on public.profiles, public.games, public.markets, public.trades, public.price_snapshots to anon, authenticated;
grant select on public.wallets, public.wallet_ledger, public.positions to authenticated;
grant execute on function public.quote_trade(uuid,public.market_outcome,public.trade_side,bigint) to authenticated;
grant execute on function public.execute_trade(uuid,public.market_outcome,public.trade_side,bigint,bigint,uuid,jsonb) to authenticated;
revoke execute on function public.settle_market(uuid,public.market_outcome) from public, anon, authenticated;
grant execute on function public.settle_market(uuid,public.market_outcome) to service_role;
revoke execute on function public.acquire_worker_lease(text,uuid,integer) from public, anon, authenticated;
grant execute on function public.acquire_worker_lease(text,uuid,integer) to service_role;
grant all on all tables in schema public to service_role;

do $$ begin
  alter publication supabase_realtime add table public.games;
  alter publication supabase_realtime add table public.markets;
  alter publication supabase_realtime add table public.trades;
  alter publication supabase_realtime add table public.price_snapshots;
  alter publication supabase_realtime add table public.wallets;
  alter publication supabase_realtime add table public.positions;
exception when duplicate_object then null; end $$;

commit;
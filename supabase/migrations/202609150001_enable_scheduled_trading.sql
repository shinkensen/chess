-- Enable trading on scheduled markets (allow pre-game predictions)
-- This migration modifies the quote_trade and execute_trade functions to allow trading before games start

-- Update quote_trade to accept scheduled markets
create or replace function public.quote_trade(
  p_market_id uuid,
  p_outcome public.market_outcome,
  p_side public.trade_side,
  p_shares_milli bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m public.markets%rowtype;
  v_delta bigint;
  v_before bigint;
  v_after bigint;
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

-- Update execute_trade to accept scheduled markets and remove game_not_started check
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
  -- Removed the game_not_started check to enable pre-game trading
  select * into w from public.wallets where profile_id=v_user for update;
  if not found then raise exception 'wallet_not_found'; end if;
  q := public.quote_trade(p_market_id, p_outcome, p_side, p_shares_milli);
  v_total := (q->>'totalCents')::bigint;
  if p_side='buy' and v_total>p_limit_cents then raise exception 'price_too_high'; end if;
  if p_side='sell' and v_total<p_limit_cents then raise exception 'price_too_low'; end if;
  if p_side='buy' and v_total>w.balance_cents then raise exception 'insufficient_funds'; end if;
  select * into p from public.positions where market_id=p_market_id and profile_id=v_user and outcome=p_outcome for update;
  if p_side='sell' and (p.shares_milli is null or p.shares_milli<p_shares_milli) then
    raise exception 'insufficient_shares';
  end if;
  if p_side='buy' then
    update public.wallets set balance_cents=balance_cents-v_total where profile_id=v_user;
    insert into public.wallet_ledger (profile_id,amount_cents,balance_after_cents,kind,reference_id,description)
    values (v_user,-v_total,(select balance_cents from public.wallets where profile_id=v_user),'trade',p_market_id,'Buy '||p_shares_milli||' '||p_outcome||' shares');
  else
    update public.wallets set balance_cents=balance_cents+v_total where profile_id=v_user;
    insert into public.wallet_ledger (profile_id,amount_cents,balance_after_cents,kind,reference_id,description)
    values (v_user,v_total,(select balance_cents from public.wallets where profile_id=v_user),'trade',p_market_id,'Sell '||p_shares_milli||' '||p_outcome||' shares');
  end if;
  if p.id is null then
    insert into public.positions (market_id,profile_id,outcome,shares_milli,cost_basis_cents)
    values (p_market_id,v_user,p_outcome,case when p_side='buy' then p_shares_milli else 0 end,case when p_side='buy' then v_total else 0 end)
    returning * into p;
  else
    if p_side='buy' then
      v_new_basis := p.cost_basis_cents + v_total;
      update public.positions set shares_milli=shares_milli+p_shares_milli,cost_basis_cents=v_new_basis where id=p.id;
    else
      v_new_basis := greatest(0, p.cost_basis_cents - (p.cost_basis_cents::numeric*p_shares_milli/p.shares_milli)::bigint);
      update public.positions set shares_milli=shares_milli-p_shares_milli,cost_basis_cents=v_new_basis where id=p.id;
    end if;
  end if;
  update public.markets set
    white_q = white_q + case when p_outcome='white' and p_side='buy' then p_shares_milli when p_outcome='white' and p_side='sell' then -p_shares_milli else 0 end,
    draw_q = draw_q + case when p_outcome='draw' and p_side='buy' then p_shares_milli when p_outcome='draw' and p_side='sell' then -p_shares_milli else 0 end,
    black_q = black_q + case when p_outcome='black' and p_side='buy' then p_shares_milli when p_outcome='black' and p_side='sell' then -p_shares_milli else 0 end,
    volume_cents = volume_cents + v_total
  where id=p_market_id;
  insert into public.trades (market_id,profile_id,outcome,side,shares_milli,total_cents,idempotency_key,metadata)
  values (p_market_id,v_user,p_outcome,p_side,p_shares_milli,v_total,p_idempotency_key,p_metadata)
  returning id into v_trade_id;
  return jsonb_build_object('tradeId', v_trade_id, 'totalCents', v_total, 'duplicate', false);
end;
$$;




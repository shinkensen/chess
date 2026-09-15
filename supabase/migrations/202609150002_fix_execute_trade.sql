-- Force update execute_trade function to use wallet_ledger correctly
-- This fixes the "relation public.ledger does not exist" error

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

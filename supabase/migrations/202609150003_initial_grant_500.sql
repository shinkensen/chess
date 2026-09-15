-- Reduce the welcome grant from 10,000 to 500 credits (50,000 cents).

alter table public.wallets alter column balance_cents set default 50000;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  v_name := left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'Player'), 32);
  insert into public.profiles(id, display_name) values (new.id, v_name) on conflict do nothing;
  insert into public.wallets(profile_id, balance_cents) values (new.id, 50000) on conflict do nothing;
  insert into public.wallet_ledger(profile_id, amount_cents, balance_after_cents, kind, reference_id, description)
  values (new.id, 50000, 50000, 'initial_grant', new.id, 'Welcome grant · no cash value')
  on conflict (profile_id, kind, reference_id) do nothing;
  return new;
end;
$$;

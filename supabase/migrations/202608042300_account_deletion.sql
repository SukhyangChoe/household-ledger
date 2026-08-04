revoke delete
on public.accounts
from authenticated;

create or replace function public.delete_unused_account(
  p_account_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_household_id uuid;
  v_is_living_account boolean;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select
    accounts.household_id,
    accounts.is_living_account
  into
    v_household_id,
    v_is_living_account
  from public.accounts
  where accounts.id = p_account_id;

  if not found then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.household_members
    where household_members.household_id = v_household_id
      and household_members.user_id = auth.uid()
      and household_members.is_active
  ) then
    raise exception 'ACCOUNT_ACCESS_DENIED';
  end if;

  if v_is_living_account then
    raise exception 'ACCOUNT_IS_LIVING';
  end if;

  if exists (
    select 1
    from public.cards
    where cards.payment_account_id = p_account_id
  ) then
    raise exception 'ACCOUNT_IN_USE';
  end if;

  if exists (
    select 1
    from public.categories
    where categories.default_account_id = p_account_id
  ) then
    raise exception 'ACCOUNT_IN_USE';
  end if;

  if exists (
    select 1
    from public.recurring_rules
    where recurring_rules.account_id = p_account_id
  ) then
    raise exception 'ACCOUNT_IN_USE';
  end if;

  if exists (
    select 1
    from public.transactions
    where transactions.account_id = p_account_id
  ) then
    raise exception 'ACCOUNT_IN_USE';
  end if;

  if exists (
    select 1
    from public.account_reconciliations
    where account_reconciliations.account_id = p_account_id
  ) then
    raise exception 'ACCOUNT_IN_USE';
  end if;

  delete from public.accounts
  where accounts.id = p_account_id
    and accounts.household_id = v_household_id;

  if not found then
    raise exception 'ACCOUNT_DELETE_FAILED';
  end if;
end;
$$;

revoke all
on function public.delete_unused_account(uuid)
from public;

grant execute
on function public.delete_unused_account(uuid)
to authenticated;
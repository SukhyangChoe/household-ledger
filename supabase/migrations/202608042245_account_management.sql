alter table public.accounts
add constraint accounts_living_account_must_be_active
check (not is_living_account or is_active);

create or replace function public.set_living_account(
  p_account_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_household_id uuid;
  v_is_active boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select
    a.household_id,
    a.is_active
  into
    v_household_id,
    v_is_active
  from public.accounts a
  where a.id = p_account_id;

  if not found then
    raise exception 'Account was not found.';
  end if;

  if not private.is_household_member(v_household_id) then
    raise exception 'You do not have access to this household.';
  end if;

  if not v_is_active then
    raise exception 'An inactive account cannot be the living account.';
  end if;

  update public.accounts
  set is_living_account = false
  where household_id = v_household_id
    and is_living_account
    and id <> p_account_id;

  update public.accounts
  set is_living_account = true
  where id = p_account_id;
end;
$$;

revoke all
on function public.set_living_account(uuid)
from public;

grant execute
on function public.set_living_account(uuid)
to authenticated;
create or replace function private.validate_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_category_household_id uuid;
  v_category_type public.transaction_type;
  v_category_is_active boolean;
  v_category_is_asset_income boolean;
  v_account_household_id uuid;
  v_account_is_active boolean;
  v_card_household_id uuid;
  v_card_is_active boolean;
  v_card_payment_account_id uuid;
  v_rate_household_id uuid;
  v_rate_bps integer;
  v_rate_valid_from date;
  v_rate_valid_to date;
  v_expected_living_amount bigint;
  v_validate_income_snapshot boolean := false;
begin
  new.name := trim(new.name);

  if new.name = '' then
    raise exception 'TRANSACTION_NAME_REQUIRED';
  end if;

  if new.category_id is not null then
    select
      categories.household_id,
      categories.transaction_type,
      categories.is_active,
      categories.is_asset_income
    into
      v_category_household_id,
      v_category_type,
      v_category_is_active,
      v_category_is_asset_income
    from public.categories
    where categories.id = new.category_id;

    if not found
      or v_category_household_id <> new.household_id
      or v_category_type <> new.transaction_type
    then
      raise exception 'TRANSACTION_CATEGORY_INVALID';
    end if;

    if tg_op = 'INSERT' and not v_category_is_active then
      raise exception 'TRANSACTION_CATEGORY_INACTIVE';
    end if;

    if tg_op = 'UPDATE' then
      if new.category_id is distinct from old.category_id
        and not v_category_is_active
      then
        raise exception 'TRANSACTION_CATEGORY_INACTIVE';
      end if;
    end if;
  end if;

  if new.account_id is not null then
    select
      accounts.household_id,
      accounts.is_active
    into
      v_account_household_id,
      v_account_is_active
    from public.accounts
    where accounts.id = new.account_id;

    if not found
      or v_account_household_id <> new.household_id
    then
      raise exception 'TRANSACTION_ACCOUNT_INVALID';
    end if;

    if tg_op = 'INSERT' and not v_account_is_active then
      raise exception 'TRANSACTION_ACCOUNT_INACTIVE';
    end if;

    if tg_op = 'UPDATE' then
      if new.account_id is distinct from old.account_id
        and not v_account_is_active
      then
        raise exception 'TRANSACTION_ACCOUNT_INACTIVE';
      end if;
    end if;
  end if;

  if new.card_id is not null then
    select
      cards.household_id,
      cards.is_active,
      cards.payment_account_id
    into
      v_card_household_id,
      v_card_is_active,
      v_card_payment_account_id
    from public.cards
    where cards.id = new.card_id;

    if not found
      or v_card_household_id <> new.household_id
      or new.transaction_type <> 'expense'
    then
      raise exception 'TRANSACTION_CARD_INVALID';
    end if;

    if v_card_payment_account_id <> new.account_id then
      if tg_op = 'INSERT' then
        raise exception 'TRANSACTION_CARD_ACCOUNT_MISMATCH';
      end if;

      if tg_op = 'UPDATE' then
        if new.card_id is distinct from old.card_id
          or new.account_id is distinct from old.account_id
        then
          raise exception 'TRANSACTION_CARD_ACCOUNT_MISMATCH';
        end if;
      end if;
    end if;

    if tg_op = 'INSERT' and not v_card_is_active then
      raise exception 'TRANSACTION_CARD_INACTIVE';
    end if;

    if tg_op = 'UPDATE' then
      if new.card_id is distinct from old.card_id
        and not v_card_is_active
      then
        raise exception 'TRANSACTION_CARD_INACTIVE';
      end if;
    end if;
  end if;

  if new.transaction_type = 'income' then
    if tg_op = 'INSERT' then
      v_validate_income_snapshot := true;
    end if;

    if tg_op = 'UPDATE' then
      if new.transaction_type is distinct from old.transaction_type
        or new.category_id is distinct from old.category_id
        or new.amount is distinct from old.amount
        or new.effective_date is distinct from old.effective_date
        or new.applied_rate_rule_id
          is distinct from old.applied_rate_rule_id
        or new.applied_living_rate_bps
          is distinct from old.applied_living_rate_bps
        or new.living_allocated_amount
          is distinct from old.living_allocated_amount
        or new.is_asset_income_snapshot
          is distinct from old.is_asset_income_snapshot
      then
        v_validate_income_snapshot := true;
      end if;
    end if;

    if v_validate_income_snapshot then
      select
        rate_rules.household_id,
        rate_rules.rate_bps,
        rate_rules.valid_from,
        rate_rules.valid_to
      into
        v_rate_household_id,
        v_rate_bps,
        v_rate_valid_from,
        v_rate_valid_to
      from public.rate_rules
      where rate_rules.id = new.applied_rate_rule_id;

      if not found
        or v_rate_household_id <> new.household_id
        or v_rate_bps <> new.applied_living_rate_bps
        or v_rate_valid_from > new.effective_date
        or (
          v_rate_valid_to is not null
          and v_rate_valid_to < new.effective_date
        )
      then
        raise exception 'TRANSACTION_RATE_SNAPSHOT_INVALID';
      end if;

      v_expected_living_amount := floor(
        (
          new.amount::numeric *
          new.applied_living_rate_bps::numeric +
          5000
        ) / 10000
      )::bigint;

      if new.living_allocated_amount
        is distinct from v_expected_living_amount
      then
        raise exception 'TRANSACTION_LIVING_AMOUNT_INVALID';
      end if;

      if new.is_asset_income_snapshot
        is distinct from v_category_is_asset_income
      then
        raise exception 'TRANSACTION_ASSET_SNAPSHOT_INVALID';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all
on function private.validate_transaction()
from public;

drop trigger if exists transactions_validate_values
on public.transactions;

create trigger transactions_validate_values
before insert or update
on public.transactions
for each row
execute function private.validate_transaction();


create or replace function public.set_transaction_status(
  p_transaction_id uuid,
  p_status public.transaction_status
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_household_id uuid;
  v_transaction_type public.transaction_type;
  v_current_status public.transaction_status;
  v_settlement_completed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select
    transactions.household_id,
    transactions.transaction_type,
    transactions.status,
    transactions.settlement_completed_at
  into
    v_household_id,
    v_transaction_type,
    v_current_status,
    v_settlement_completed_at
  from public.transactions
  where transactions.id = p_transaction_id
  for update;

  if not found then
    raise exception 'TRANSACTION_NOT_FOUND';
  end if;

  if not private.is_household_member(v_household_id) then
    raise exception 'TRANSACTION_ACCESS_DENIED';
  end if;

  if v_settlement_completed_at is not null then
    raise exception 'TRANSACTION_ALREADY_SETTLED';
  end if;

  if v_current_status = p_status then
    return;
  end if;

  if v_current_status = 'planned'
    and p_status in ('confirmed', 'cancelled')
  then
    update public.transactions
    set status = p_status
    where id = p_transaction_id;

    return;
  end if;

  if v_current_status = 'confirmed'
    and p_status = 'cancelled'
  then
    update public.transactions
    set status = p_status
    where id = p_transaction_id;

    return;
  end if;

  if v_current_status = 'confirmed'
    and p_status = 'refunded'
    and v_transaction_type = 'expense'
  then
    update public.transactions
    set status = p_status
    where id = p_transaction_id;

    return;
  end if;

  raise exception 'TRANSACTION_STATUS_TRANSITION_INVALID';
end;
$$;

revoke all
on function public.set_transaction_status(
  uuid,
  public.transaction_status
)
from public;

grant execute
on function public.set_transaction_status(
  uuid,
  public.transaction_status
)
to authenticated;


revoke delete
on public.transactions
from authenticated;

create or replace function public.delete_planned_manual_transaction(
  p_transaction_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_household_id uuid;
  v_status public.transaction_status;
  v_recurring_rule_id uuid;
  v_settlement_completed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select
    transactions.household_id,
    transactions.status,
    transactions.recurring_rule_id,
    transactions.settlement_completed_at
  into
    v_household_id,
    v_status,
    v_recurring_rule_id,
    v_settlement_completed_at
  from public.transactions
  where transactions.id = p_transaction_id
  for update;

  if not found then
    raise exception 'TRANSACTION_NOT_FOUND';
  end if;

  if not private.is_household_member(v_household_id) then
    raise exception 'TRANSACTION_ACCESS_DENIED';
  end if;

  if v_status <> 'planned'
    or v_recurring_rule_id is not null
    or v_settlement_completed_at is not null
  then
    raise exception 'TRANSACTION_DELETE_NOT_ALLOWED';
  end if;

  delete from public.transactions
  where id = p_transaction_id;
end;
$$;

revoke all
on function public.delete_planned_manual_transaction(uuid)
from public;

grant execute
on function public.delete_planned_manual_transaction(uuid)
to authenticated;

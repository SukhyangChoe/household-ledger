-- 카테고리 이름은 같은 가계·같은 상위 카테고리 안에서
-- 대소문자를 구분하지 않고 중복되지 않게 한다.
create unique index if not exists categories_unique_name_per_parent_ci
on public.categories (
  household_id,
  coalesce(
    parent_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  ),
  lower(name)
);

create or replace function private.validate_category()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_parent_household_id uuid;
  v_parent_transaction_type public.transaction_type;
  v_rate_household_id uuid;
  v_rate_valid_to date;
  v_rate_is_active boolean;
  v_account_household_id uuid;
  v_account_is_active boolean;
begin
  new.name := trim(new.name);

  if new.name = '' then
    raise exception 'CATEGORY_NAME_REQUIRED';
  end if;

  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'CATEGORY_PARENT_SELF';
    end if;

    select
      categories.household_id,
      categories.transaction_type
    into
      v_parent_household_id,
      v_parent_transaction_type
    from public.categories
    where categories.id = new.parent_id;

    if not found
      or v_parent_household_id <> new.household_id
      or v_parent_transaction_type <> new.transaction_type
    then
      raise exception 'CATEGORY_PARENT_INVALID';
    end if;
  end if;

  if new.transaction_type = 'income' then
    if new.suggested_fund_purpose is not null
      or new.suggested_expense_nature is not null
    then
      raise exception 'CATEGORY_INCOME_DEFAULT_INVALID';
    end if;

    if new.rate_rule_id is null then
      raise exception 'CATEGORY_RATE_RULE_REQUIRED';
    end if;

    if new.is_asset_income is null then
      raise exception 'CATEGORY_ASSET_INCOME_REQUIRED';
    end if;

    select
      rate_rules.household_id,
      rate_rules.valid_to,
      rate_rules.is_active
    into
      v_rate_household_id,
      v_rate_valid_to,
      v_rate_is_active
    from public.rate_rules
    where rate_rules.id = new.rate_rule_id;

    if not found
      or v_rate_household_id <> new.household_id
    then
      raise exception 'CATEGORY_RATE_RULE_INVALID';
    end if;

    if v_rate_valid_to is not null
      or not v_rate_is_active
    then
      if tg_op = 'INSERT' then
        raise exception 'CATEGORY_RATE_RULE_NOT_CURRENT';
      end if;

      if new.rate_rule_id is distinct from old.rate_rule_id then
        raise exception 'CATEGORY_RATE_RULE_NOT_CURRENT';
      end if;
    end if;

    if new.default_account_id is not null then
      select
        accounts.household_id,
        accounts.is_active
      into
        v_account_household_id,
        v_account_is_active
      from public.accounts
      where accounts.id = new.default_account_id;

      if not found
        or v_account_household_id <> new.household_id
      then
        raise exception 'CATEGORY_DEFAULT_ACCOUNT_INVALID';
      end if;

      if not v_account_is_active then
        if tg_op = 'INSERT' then
          raise exception 'CATEGORY_DEFAULT_ACCOUNT_INACTIVE';
        end if;

        if new.default_account_id
          is distinct from old.default_account_id
        then
          raise exception 'CATEGORY_DEFAULT_ACCOUNT_INACTIVE';
        end if;
      end if;
    end if;
  elsif new.transaction_type = 'expense' then
    if new.suggested_fund_purpose is null
      or new.suggested_expense_nature is null
    then
      raise exception 'CATEGORY_EXPENSE_DEFAULT_REQUIRED';
    end if;

    if new.rate_rule_id is not null
      or new.is_asset_income is not null
      or new.default_account_id is not null
    then
      raise exception 'CATEGORY_EXPENSE_INCOME_FIELD_INVALID';
    end if;
  else
    raise exception 'CATEGORY_TRANSACTION_TYPE_INVALID';
  end if;

  return new;
end;
$$;

revoke all
on function private.validate_category()
from public;

drop trigger if exists categories_validate_values
on public.categories;

create trigger categories_validate_values
before insert or update
on public.categories
for each row
execute function private.validate_category();

revoke delete
on public.categories
from authenticated;

create or replace function public.delete_unused_category(
  p_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select categories.household_id
  into v_household_id
  from public.categories
  where categories.id = p_category_id;

  if not found then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;

  if not private.is_household_member(v_household_id) then
    raise exception 'CATEGORY_ACCESS_DENIED';
  end if;

  if exists (
    select 1
    from public.categories child_category
    where child_category.parent_id = p_category_id
  ) then
    raise exception 'CATEGORY_HAS_CHILDREN';
  end if;

  if exists (
    select 1
    from public.recurring_rules
    where recurring_rules.category_id = p_category_id
  ) then
    raise exception 'CATEGORY_IN_USE';
  end if;

  if exists (
    select 1
    from public.transactions
    where transactions.category_id = p_category_id
  ) then
    raise exception 'CATEGORY_IN_USE';
  end if;

  delete from public.categories
  where categories.id = p_category_id
    and categories.household_id = v_household_id;

  if not found then
    raise exception 'CATEGORY_DELETE_FAILED';
  end if;
end;
$$;

revoke all
on function public.delete_unused_category(uuid)
from public;

grant execute
on function public.delete_unused_category(uuid)
to authenticated;

-- 카테고리에서 자금 목적 기본값을 제거한다.
-- 자금 목적은 transaction / recurring_rule 자체의 값으로만 관리한다.

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
    if new.suggested_expense_nature is not null then
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
    if new.suggested_expense_nature is null then
      raise exception 'CATEGORY_EXPENSE_NATURE_REQUIRED';
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

-- 초기 스키마의 categories CHECK 제약 중
-- suggested_fund_purpose를 참조하는 제약을 제거한다.
do $$
declare
  v_constraint_name text;
begin
  for v_constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel
      on rel.oid = con.conrelid
    join pg_namespace nsp
      on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'categories'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid)
        ilike '%suggested_fund_purpose%'
  loop
    execute format(
      'alter table public.categories drop constraint %I',
      v_constraint_name
    );
  end loop;
end
$$;

alter table public.categories
  drop column if exists suggested_fund_purpose;

-- 컬럼 제거 후에도 수입/지출별 필드 조합을 DB에서 보호한다.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_transaction_fields_check'
  ) then
    alter table public.categories
      add constraint categories_transaction_fields_check
      check (
        (
          transaction_type = 'income'
          and suggested_expense_nature is null
        )
        or
        (
          transaction_type = 'expense'
          and rate_rule_id is null
          and is_asset_income is null
        )
      );
  end if;
end
$$;
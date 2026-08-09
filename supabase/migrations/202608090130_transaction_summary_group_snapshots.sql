-- 카테고리의 월별 가계부 집계 분류를 거래 생성 시 snapshot으로 보존한다.
-- 이미 snapshot이 저장된 거래는 이후 카테고리 분류가 바뀌어도 변경하지 않는다.
-- 1차 분류 도입 당시 미분류였던 기존 카테고리는, 최초 분류가 지정될 때
-- 아직 snapshot이 비어 있는 과거 거래에 한해서 한 번만 보정한다.

alter table public.transactions
  add column if not exists expense_summary_group_snapshot
    public.expense_summary_group,
  add column if not exists income_summary_group_snapshot
    public.income_summary_group;

-- 이미 집계 분류가 지정된 카테고리를 사용하는 기존 거래는 현재 값을
-- 최초 snapshot으로 채운다. 미분류 카테고리 거래는 아직 null로 둔다.
update public.transactions as transactions
set income_summary_group_snapshot =
  categories.income_summary_group
from public.categories as categories
where transactions.category_id = categories.id
  and transactions.transaction_type = 'income'
  and transactions.income_summary_group_snapshot is null
  and categories.income_summary_group is not null;

update public.transactions as transactions
set expense_summary_group_snapshot =
  categories.expense_summary_group
from public.categories as categories
where transactions.category_id = categories.id
  and transactions.transaction_type = 'expense'
  and transactions.expense_summary_group_snapshot is null
  and categories.expense_summary_group is not null;

create or replace function private.apply_transaction_summary_group_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_category_transaction_type public.transaction_type;
  v_expense_summary_group public.expense_summary_group;
  v_income_summary_group public.income_summary_group;
begin
  if new.transaction_type = 'transfer' then
    new.expense_summary_group_snapshot := null;
    new.income_summary_group_snapshot := null;
    return new;
  end if;

  if new.category_id is null then
    return new;
  end if;

  select
    categories.transaction_type,
    categories.expense_summary_group,
    categories.income_summary_group
  into
    v_category_transaction_type,
    v_expense_summary_group,
    v_income_summary_group
  from public.categories
  where categories.id = new.category_id;

  -- 카테고리 자체의 유효성은 기존 validate_transaction()에서 검증한다.
  -- 여기서는 정상 카테고리를 찾았을 때 snapshot만 적용한다.
  if not found
    or v_category_transaction_type <> new.transaction_type
  then
    return new;
  end if;

  if new.transaction_type = 'income' then
    new.expense_summary_group_snapshot := null;

    if tg_op = 'INSERT' then
      new.income_summary_group_snapshot :=
        v_income_summary_group;
    elsif new.category_id is distinct from old.category_id
      or old.income_summary_group_snapshot is null
    then
      new.income_summary_group_snapshot :=
        v_income_summary_group;
    else
      -- 이미 저장된 snapshot은 카테고리 설정 변경과 무관하게 보존한다.
      new.income_summary_group_snapshot :=
        old.income_summary_group_snapshot;
    end if;

  elsif new.transaction_type = 'expense' then
    new.income_summary_group_snapshot := null;

    if tg_op = 'INSERT' then
      new.expense_summary_group_snapshot :=
        v_expense_summary_group;
    elsif new.category_id is distinct from old.category_id
      or old.expense_summary_group_snapshot is null
    then
      new.expense_summary_group_snapshot :=
        v_expense_summary_group;
    else
      -- 이미 저장된 snapshot은 카테고리 설정 변경과 무관하게 보존한다.
      new.expense_summary_group_snapshot :=
        old.expense_summary_group_snapshot;
    end if;
  end if;

  return new;
end;
$$;

revoke all
on function private.apply_transaction_summary_group_snapshot()
from public;

drop trigger if exists transactions_apply_summary_group_snapshot
on public.transactions;

create trigger transactions_apply_summary_group_snapshot
before insert or update
on public.transactions
for each row
execute function private.apply_transaction_summary_group_snapshot();

-- 1차 도입 당시 미분류였던 기존 카테고리는 사용자가 최초로 분류를 지정하는
-- 순간, snapshot이 아직 비어 있는 과거 거래에만 해당 분류를 채운다.
-- 이후 카테고리 분류를 다시 변경해도 이미 채워진 과거 거래는 변경하지 않는다.
create or replace function private.backfill_transaction_summary_group_on_category_classification()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.transaction_type = 'income'
    and old.income_summary_group is null
    and new.income_summary_group is not null
  then
    update public.transactions
    set income_summary_group_snapshot =
      new.income_summary_group
    where category_id = new.id
      and transaction_type = 'income'
      and income_summary_group_snapshot is null;
  elsif new.transaction_type = 'expense'
    and old.expense_summary_group is null
    and new.expense_summary_group is not null
  then
    update public.transactions
    set expense_summary_group_snapshot =
      new.expense_summary_group
    where category_id = new.id
      and transaction_type = 'expense'
      and expense_summary_group_snapshot is null;
  end if;

  return new;
end;
$$;

revoke all
on function private.backfill_transaction_summary_group_on_category_classification()
from public;

drop trigger if exists categories_backfill_transaction_summary_group
on public.categories;

create trigger categories_backfill_transaction_summary_group
after update of expense_summary_group, income_summary_group
on public.categories
for each row
execute function private.backfill_transaction_summary_group_on_category_classification();

comment on column public.transactions.expense_summary_group_snapshot is
  '거래 생성/카테고리 변경 시점의 지출 집계 분류 snapshot';

comment on column public.transactions.income_summary_group_snapshot is
  '거래 생성/카테고리 변경 시점의 수입 집계 분류 snapshot';
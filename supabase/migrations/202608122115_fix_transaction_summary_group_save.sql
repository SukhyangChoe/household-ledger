-- 거래의 월별 가계부 표시 분류 snapshot을 사용자가 직접 수정할 수 있도록
-- snapshot 자동 적용 trigger의 실행 범위를 좁힌다.
--
-- 정책:
-- 1. INSERT: 카테고리의 현재 기본 분류를 snapshot으로 저장
-- 2. UPDATE: category_id가 실제로 바뀐 경우에만 새 카테고리 기본 분류 적용
-- 3. 그 외 UPDATE: 기존/사용자 지정 snapshot을 건드리지 않음

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

  -- UPDATE에서는 카테고리가 실제로 바뀌지 않았다면
  -- 사용자가 지정한 snapshot을 그대로 둔다.
  if tg_op = 'UPDATE'
    and new.category_id is not distinct from old.category_id
  then
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

  -- 카테고리 유효성 자체는 validate_transaction()에서 검증한다.
  if not found
    or v_category_transaction_type <> new.transaction_type
  then
    return new;
  end if;

  if new.transaction_type = 'income' then
    new.expense_summary_group_snapshot := null;
    new.income_summary_group_snapshot :=
      v_income_summary_group;
  elsif new.transaction_type = 'expense' then
    new.income_summary_group_snapshot := null;
    new.expense_summary_group_snapshot :=
      v_expense_summary_group;
  end if;

  return new;
end;
$$;

revoke all
on function private.apply_transaction_summary_group_snapshot()
from public;

-- 기존의 모든 UPDATE에 실행되는 trigger를 제거한다.
drop trigger if exists transactions_apply_summary_group_snapshot
on public.transactions;

drop trigger if exists transactions_apply_summary_group_snapshot_insert
on public.transactions;

drop trigger if exists transactions_apply_summary_group_snapshot_category
on public.transactions;

-- 신규 거래 생성 시 카테고리 기본 분류를 snapshot으로 저장한다.
create trigger transactions_apply_summary_group_snapshot_insert
before insert
on public.transactions
for each row
execute function private.apply_transaction_summary_group_snapshot();

-- 거래 수정 시에는 category_id가 UPDATE 문에 포함된 경우에만 호출하고,
-- 함수 내부에서 실제 값이 달라졌는지 다시 확인한다.
create trigger transactions_apply_summary_group_snapshot_category
before update of category_id
on public.transactions
for each row
execute function private.apply_transaction_summary_group_snapshot();

comment on column public.transactions.expense_summary_group_snapshot is
  '거래 생성/카테고리 변경 시 기본 분류를 저장하며, 거래 수정에서 개별 변경 가능';

comment on column public.transactions.income_summary_group_snapshot is
  '거래 생성/카테고리 변경 시점의 수입 집계 분류 snapshot';
-- 월별 가계부 집계를 위한 카테고리 분류 축을 추가한다.
-- 기존 카테고리는 임의 추정을 피하기 위해 대부분 미분류 상태로 둔다.
-- 자산소득 여부가 이미 명확한 수입 카테고리만 자산소득으로 안전하게 보정한다.

do $$
begin
  create type public.expense_summary_group as enum (
    'monthly',
    'annual',
    'variable',
    'repayment_saving'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.income_summary_group as enum (
    'earned',
    'asset',
    'variable'
  );
exception
  when duplicate_object then null;
end
$$;

alter table public.categories
  add column if not exists expense_summary_group
    public.expense_summary_group,
  add column if not exists income_summary_group
    public.income_summary_group;

-- 기존 값 중 확실하게 판별 가능한 자산소득만 자동 분류한다.
update public.categories
set income_summary_group = 'asset'
where transaction_type = 'income'
  and is_asset_income = true
  and income_summary_group is null;

create or replace function private.validate_category_summary_group()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.transaction_type = 'income' then
    if new.expense_summary_group is not null then
      raise exception 'CATEGORY_INCOME_EXPENSE_SUMMARY_INVALID';
    end if;

    if tg_op = 'INSERT'
      and new.income_summary_group is null
    then
      raise exception 'CATEGORY_INCOME_SUMMARY_GROUP_REQUIRED';
    end if;

    if new.income_summary_group is not null then
      new.is_asset_income :=
        new.income_summary_group = 'asset';
    end if;
  elsif new.transaction_type = 'expense' then
    if new.income_summary_group is not null then
      raise exception 'CATEGORY_EXPENSE_INCOME_SUMMARY_INVALID';
    end if;

    if tg_op = 'INSERT'
      and new.expense_summary_group is null
    then
      raise exception 'CATEGORY_EXPENSE_SUMMARY_GROUP_REQUIRED';
    end if;
  end if;

  return new;
end;
$$;

revoke all
on function private.validate_category_summary_group()
from public;

drop trigger if exists categories_validate_summary_group
on public.categories;

create trigger categories_validate_summary_group
before insert or update
on public.categories
for each row
execute function private.validate_category_summary_group();

comment on column public.categories.expense_summary_group is
  '월별 가계부 지출 집계 분류: 월간/연간/변동/상환·적립';

comment on column public.categories.income_summary_group is
  '월별 가계부 수입 집계 분류: 근로/자산/변동소득';

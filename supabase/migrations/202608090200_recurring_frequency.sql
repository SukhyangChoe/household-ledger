-- 정기 항목에 반복 주기(매월/매년)를 추가한다.
-- 기존 규칙은 모두 매월 반복으로 유지한다.

do $$
begin
  create type public.recurrence_frequency as enum (
    'monthly',
    'yearly'
  );
exception
  when duplicate_object then null;
end
$$;

alter table public.recurring_rules
  add column if not exists recurrence_frequency
    public.recurrence_frequency
    not null
    default 'monthly',
  add column if not exists recurrence_month
    smallint;

alter table public.recurring_rules
  drop constraint if exists recurring_rules_recurrence_shape;

alter table public.recurring_rules
  add constraint recurring_rules_recurrence_shape
  check (
    (
      recurrence_frequency = 'monthly'
      and recurrence_month is null
    )
    or
    (
      recurrence_frequency = 'yearly'
      and recurrence_month between 1 and 12
    )
  );

comment on column public.recurring_rules.recurrence_frequency is
  '정기 거래 반복 주기: monthly 또는 yearly';

comment on column public.recurring_rules.recurrence_month is
  'yearly 규칙의 연간 반영 월(1~12). monthly 규칙은 null';

-- 월별 생성 조회에서 반복 주기를 함께 필터링할 수 있도록 인덱스를 갱신한다.
drop index if exists public.recurring_rules_generation_idx;

create index recurring_rules_generation_idx
on public.recurring_rules(
  household_id,
  is_active,
  recurrence_frequency,
  recurrence_month,
  start_month,
  end_month
);

create or replace function public.generate_recurring_transactions(
  p_household_id uuid,
  p_target_month date
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_target_month date;
  v_inserted_count integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not private.is_household_member(p_household_id) then
    raise exception 'HOUSEHOLD_ACCESS_DENIED';
  end if;

  if p_target_month is null then
    raise exception 'TARGET_MONTH_REQUIRED';
  end if;

  v_target_month :=
    date_trunc('month', p_target_month)::date;

  if v_target_month <> p_target_month then
    raise exception 'TARGET_MONTH_MUST_BE_FIRST_DAY';
  end if;

  with eligible_rules as (
    select
      recurring_rules.*,
      categories.is_asset_income,
      seed_rate_rules.rule_key,
      case
        when recurring_rules.card_id is not null
          then cards.payment_account_id
        else recurring_rules.account_id
      end as resolved_account_id,
      case
        when recurring_rules.card_id is not null
          then cards.payment_day
        else recurring_rules.payment_day
      end as resolved_payment_day
    from public.recurring_rules
    join public.categories
      on categories.id = recurring_rules.category_id
     and categories.household_id =
       recurring_rules.household_id
    left join public.cards
      on cards.id = recurring_rules.card_id
     and cards.household_id =
       recurring_rules.household_id
    left join public.rate_rules as seed_rate_rules
      on seed_rate_rules.id =
        recurring_rules.rate_rule_id
     and seed_rate_rules.household_id =
       recurring_rules.household_id
    where recurring_rules.household_id =
      p_household_id
      and recurring_rules.is_active
      and recurring_rules.start_month <=
        v_target_month
      and (
        recurring_rules.end_month is null
        or recurring_rules.end_month >=
          v_target_month
      )
      and (
        recurring_rules.recurrence_frequency =
          'monthly'
        or (
          recurring_rules.recurrence_frequency =
            'yearly'
          and recurring_rules.recurrence_month =
            extract(month from v_target_month)::integer
        )
      )
  ),
  dated_rules as (
    select
      eligible_rules.*,
      (
        v_target_month
        + (
          least(
            eligible_rules.resolved_payment_day,
            extract(
              day
              from (
                v_target_month
                + interval '1 month'
                - interval '1 day'
              )
            )::integer
          ) - 1
        )
      )::date as resolved_effective_date
    from eligible_rules
    where eligible_rules.resolved_account_id
      is not null
      and eligible_rules.resolved_payment_day
        between 1 and 31
  ),
  resolved_rules as (
    select
      dated_rules.*,
      applied_rate_rules.id
        as applied_rate_rule_id,
      applied_rate_rules.rate_bps
        as applied_living_rate_bps
    from dated_rules
    left join lateral (
      select
        rate_rules.id,
        rate_rules.rate_bps
      from public.rate_rules
      where dated_rules.transaction_type =
          'income'
        and rate_rules.household_id =
          dated_rules.household_id
        and rate_rules.rule_key =
          dated_rules.rule_key
        and rate_rules.valid_from <=
          dated_rules.resolved_effective_date
        and (
          rate_rules.valid_to is null
          or rate_rules.valid_to >=
            dated_rules.resolved_effective_date
        )
      order by rate_rules.valid_from desc
      limit 1
    ) as applied_rate_rules
      on true
    where dated_rules.transaction_type =
        'expense'
      or applied_rate_rules.id is not null
  )
  insert into public.transactions (
    household_id,
    effective_date,
    transaction_type,
    name,
    amount,
    status,
    category_id,
    account_id,
    owner_type,
    fund_purpose,
    expense_nature,
    card_id,
    recurring_rule_id,
    applied_rate_rule_id,
    applied_living_rate_bps,
    living_allocated_amount,
    is_asset_income_snapshot,
    memo
  )
  select
    resolved_rules.household_id,
    resolved_rules.resolved_effective_date,
    resolved_rules.transaction_type,
    resolved_rules.name,
    resolved_rules.amount,
    'planned'::public.transaction_status,
    resolved_rules.category_id,
    resolved_rules.resolved_account_id,
    resolved_rules.owner_type,
    resolved_rules.fund_purpose,
    resolved_rules.expense_nature,
    resolved_rules.card_id,
    resolved_rules.id,
    case
      when resolved_rules.transaction_type =
        'income'
        then resolved_rules.applied_rate_rule_id
      else null
    end,
    case
      when resolved_rules.transaction_type =
        'income'
        then resolved_rules.applied_living_rate_bps
      else null
    end,
    case
      when resolved_rules.transaction_type =
        'income'
        then round(
          (
            resolved_rules.amount::numeric
            * resolved_rules
              .applied_living_rate_bps::numeric
          ) / 10000
        )::bigint
      else null
    end,
    case
      when resolved_rules.transaction_type =
        'income'
        then coalesce(
          resolved_rules.is_asset_income,
          false
        )
      else null
    end,
    resolved_rules.memo
  from resolved_rules
  on conflict (
    recurring_rule_id,
    effective_month
  )
  where recurring_rule_id is not null
  do nothing;

  get diagnostics
    v_inserted_count = row_count;

  return v_inserted_count;
end;
$$;

revoke all
on function public.generate_recurring_transactions(
  uuid,
  date
)
from public;

grant execute
on function public.generate_recurring_transactions(
  uuid,
  date
)
to authenticated;
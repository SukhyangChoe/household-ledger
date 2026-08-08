create index if not exists recurring_rules_generation_idx
on public.recurring_rules(
  household_id,
  is_active,
  start_month,
  end_month
);

create or replace function public.delete_unused_recurring_rule(
  p_recurring_rule_id uuid
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

  select recurring_rules.household_id
  into v_household_id
  from public.recurring_rules
  where recurring_rules.id = p_recurring_rule_id
  for update;

  if not found then
    raise exception 'RECURRING_RULE_NOT_FOUND';
  end if;

  if not private.is_household_member(v_household_id) then
    raise exception 'RECURRING_RULE_ACCESS_DENIED';
  end if;

  if exists (
    select 1
    from public.transactions
    where transactions.recurring_rule_id =
      p_recurring_rule_id
  ) then
    raise exception 'RECURRING_RULE_IN_USE';
  end if;

  delete from public.recurring_rules
  where recurring_rules.id = p_recurring_rule_id;
end;
$$;

revoke all
on function public.delete_unused_recurring_rule(uuid)
from public;

grant execute
on function public.delete_unused_recurring_rule(uuid)
to authenticated;


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

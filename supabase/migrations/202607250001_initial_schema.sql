create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create schema if not exists private;

create type public.owner_type as enum ('wife', 'husband', 'joint');
create type public.transaction_type as enum ('income', 'expense', 'transfer');
create type public.transaction_status as enum ('planned', 'confirmed', 'cancelled', 'refunded');
create type public.fund_purpose as enum ('living', 'investment');
create type public.expense_nature as enum ('fixed', 'variable', 'irregular');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'KRW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'admin' check (role in ('admin', 'member')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id)
);
create index household_members_user_household_idx
  on public.household_members(user_id, household_id)
  where is_active;

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  owner_type public.owner_type not null,
  is_living_account boolean not null default false,
  is_active boolean not null default true,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);
create unique index accounts_one_living_account_per_household
  on public.accounts(household_id)
  where is_living_account;

create table public.rate_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  rule_key text not null,
  name text not null,
  rate_bps integer not null check (rate_bps between 0 and 10000),
  valid_from date not null,
  valid_to date,
  is_active boolean not null default true,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, rule_key, valid_from),
  exclude using gist (
    household_id with =,
    rule_key with =,
    daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') with &&
  ),
  check (valid_to is null or valid_to >= valid_from)
);
create index rate_rules_lookup_idx
  on public.rate_rules(household_id, rule_key, valid_from, valid_to);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  transaction_type public.transaction_type not null check (transaction_type <> 'transfer'),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  suggested_fund_purpose public.fund_purpose,
  suggested_expense_nature public.expense_nature,
  rate_rule_id uuid references public.rate_rules(id) on delete set null,
  is_asset_income boolean,
  default_account_id uuid references public.accounts(id) on delete set null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (transaction_type = 'income'
      and suggested_fund_purpose is null
      and suggested_expense_nature is null)
    or
    (transaction_type = 'expense'
      and rate_rule_id is null
      and is_asset_income is null)
  )
);
create unique index categories_unique_name_per_parent
  on public.categories(
    household_id,
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    name
  );

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  owner_type public.owner_type not null,
  payment_account_id uuid not null references public.accounts(id),
  payment_day smallint not null check (payment_day between 1 and 31),
  usage_period_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  transaction_type public.transaction_type not null check (transaction_type <> 'transfer'),
  amount bigint not null check (amount > 0),
  start_month date not null check (date_trunc('month', start_month)::date = start_month),
  end_month date check (end_month is null or date_trunc('month', end_month)::date = end_month),
  payment_day smallint not null check (payment_day between 1 and 31),
  account_id uuid references public.accounts(id) on delete set null,
  card_id uuid references public.cards(id) on delete set null,
  category_id uuid not null references public.categories(id),
  rate_rule_id uuid references public.rate_rules(id) on delete set null,
  fund_purpose public.fund_purpose,
  expense_nature public.expense_nature,
  owner_type public.owner_type not null,
  show_occurrence_progress boolean not null default false,
  is_active boolean not null default true,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_month is null or end_month >= start_month),
  check (account_id is not null or card_id is not null),
  check (
    (transaction_type = 'income'
      and account_id is not null
      and card_id is null
      and rate_rule_id is not null
      and fund_purpose is null
      and expense_nature is null)
    or
    (transaction_type = 'expense'
      and rate_rule_id is null
      and fund_purpose is not null
      and expense_nature is not null)
  )
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  effective_date date not null,
  effective_month date generated always as (
    make_date(
      extract(year from effective_date)::integer,
      extract(month from effective_date)::integer,
      1
    )
  ) stored,
  transaction_type public.transaction_type not null,
  name text not null,
  amount bigint not null check (amount > 0),
  status public.transaction_status not null default 'planned',
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  owner_type public.owner_type not null,
  fund_purpose public.fund_purpose,
  expense_nature public.expense_nature,
  card_id uuid references public.cards(id) on delete set null,
  recurring_rule_id uuid references public.recurring_rules(id) on delete set null,
  applied_rate_rule_id uuid references public.rate_rules(id) on delete set null,
  applied_living_rate_bps integer check (applied_living_rate_bps between 0 and 10000),
  living_allocated_amount bigint check (living_allocated_amount >= 0),
  is_asset_income_snapshot boolean,
  settlement_completed_at timestamptz,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (transaction_type = 'income'
      and category_id is not null
      and account_id is not null
      and card_id is null
      and fund_purpose is null
      and expense_nature is null
      and applied_rate_rule_id is not null
      and applied_living_rate_bps is not null
      and living_allocated_amount is not null
      and living_allocated_amount <= amount
      and is_asset_income_snapshot is not null)
    or
    (transaction_type = 'expense'
      and category_id is not null
      and account_id is not null
      and fund_purpose is not null
      and expense_nature is not null
      and applied_rate_rule_id is null
      and applied_living_rate_bps is null
      and living_allocated_amount is null
      and is_asset_income_snapshot is null)
    or
    (transaction_type = 'transfer'
      and category_id is null
      and card_id is null
      and fund_purpose is null
      and expense_nature is null
      and applied_rate_rule_id is null
      and applied_living_rate_bps is null
      and living_allocated_amount is null
      and is_asset_income_snapshot is null)
  )
);
create unique index transactions_one_occurrence_per_rule_month
  on public.transactions(recurring_rule_id, effective_month)
  where recurring_rule_id is not null;
create index transactions_household_date_idx
  on public.transactions(household_id, effective_date);
create index transactions_unsettled_idx
  on public.transactions(household_id, settlement_completed_at)
  where settlement_completed_at is null;

create table public.account_reconciliations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  checked_date date not null,
  actual_balance bigint not null,
  ledger_balance bigint not null,
  difference_amount bigint generated always as (actual_balance - ledger_balance) stored,
  memo text,
  created_at timestamptz not null default now(),
  unique (account_id, checked_date)
);
create index account_reconciliations_lookup_idx
  on public.account_reconciliations(household_id, account_id, checked_date desc);

create table public.monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  snapshot_month date not null check (date_trunc('month', snapshot_month)::date = snapshot_month),
  confirmed_income bigint not null default 0,
  living_allocated_amount bigint not null default 0,
  living_expense_amount bigint not null default 0,
  investment_expense_amount bigint not null default 0,
  living_fixed_expense_amount bigint not null default 0,
  investment_fixed_expense_amount bigint not null default 0,
  asset_income_amount bigint not null default 0,
  fixed_coverage_rate_bps integer,
  living_budget_balance bigint not null default 0,
  living_account_ledger_balance bigint not null default 0,
  living_account_actual_balance bigint,
  unsettled_count integer not null default 0,
  closed_at timestamptz not null default now(),
  unique (household_id, snapshot_month)
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger households_set_updated_at
before update on public.households
for each row execute function private.set_updated_at();

create trigger household_members_set_updated_at
before update on public.household_members
for each row execute function private.set_updated_at();

create trigger accounts_set_updated_at
before update on public.accounts
for each row execute function private.set_updated_at();

create trigger rate_rules_set_updated_at
before update on public.rate_rules
for each row execute function private.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function private.set_updated_at();

create trigger cards_set_updated_at
before update on public.cards
for each row execute function private.set_updated_at();

create trigger recurring_rules_set_updated_at
before update on public.recurring_rules
for each row execute function private.set_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function private.set_updated_at();

create or replace function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = (select auth.uid())
      and hm.is_active
  );
$$;

create or replace function public.create_household_with_admin(
  p_household_name text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if nullif(trim(p_household_name), '') is null then
    raise exception 'Household name is required.';
  end if;

  if nullif(trim(p_display_name), '') is null then
    raise exception 'Display name is required.';
  end if;

  if exists (
    select 1
    from public.household_members hm
    where hm.user_id = v_user_id
      and hm.is_active
  ) then
    raise exception 'The current user already belongs to an active household.';
  end if;

  insert into public.households(name)
  values (trim(p_household_name))
  returning id into v_household_id;

  insert into public.household_members(
    household_id,
    user_id,
    display_name,
    role
  )
  values (
    v_household_id,
    v_user_id,
    trim(p_display_name),
    'admin'
  );

  return v_household_id;
end;
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.accounts enable row level security;
alter table public.rate_rules enable row level security;
alter table public.categories enable row level security;
alter table public.cards enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.transactions enable row level security;
alter table public.account_reconciliations enable row level security;
alter table public.monthly_snapshots enable row level security;

create policy households_select
on public.households
for select
to authenticated
using (private.is_household_member(id));

create policy households_update
on public.households
for update
to authenticated
using (private.is_household_member(id))
with check (private.is_household_member(id));

create policy members_select
on public.household_members
for select
to authenticated
using (private.is_household_member(household_id));

create policy accounts_all
on public.accounts
for all
to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy rate_rules_all
on public.rate_rules
for all
to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy categories_all
on public.categories
for all
to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy cards_all
on public.cards
for all
to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy recurring_rules_all
on public.recurring_rules
for all
to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy transactions_all
on public.transactions
for all
to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy reconciliations_all
on public.account_reconciliations
for all
to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy snapshots_all
on public.monthly_snapshots
for all
to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

revoke all on function private.is_household_member(uuid) from public;
revoke all on function public.create_household_with_admin(text, text) from public;

grant usage on schema public to authenticated;
grant usage on schema private to authenticated;

grant select, update on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.rate_rules to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.cards to authenticated;
grant select, insert, update, delete on public.recurring_rules to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.account_reconciliations to authenticated;
grant select, insert, update, delete on public.monthly_snapshots to authenticated;

grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function public.create_household_with_admin(text, text) to authenticated;
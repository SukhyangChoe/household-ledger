create extension if not exists pgcrypto;

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
  unique (household_id, user_id)
);

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
  on public.accounts(household_id) where is_living_account;

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
  check (valid_to is null or valid_to >= valid_from)
);
create index rate_rules_lookup_idx on public.rate_rules(household_id, rule_key, valid_from, valid_to);

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
  unique (household_id, parent_id, name),
  check (
    (transaction_type = 'income' and suggested_fund_purpose is null and suggested_expense_nature is null)
    or transaction_type = 'expense'
  )
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
  unique (household_id, name)
);

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  transaction_type public.transaction_type not null check (transaction_type <> 'transfer'),
  amount bigint not null check (amount >= 0),
  start_month date not null check (date_trunc('month', start_month)::date = start_month),
  end_month date check (end_month is null or date_trunc('month', end_month)::date = end_month),
  payment_day smallint not null check (payment_day between 1 and 31),
  account_id uuid references public.accounts(id) on delete set null,
  card_id uuid references public.cards(id) on delete set null,
  category_id uuid not null references public.categories(id),
  fund_purpose public.fund_purpose,
  expense_nature public.expense_nature,
  owner_type public.owner_type not null,
  show_occurrence_progress boolean not null default false,
  is_active boolean not null default true,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_month is null or end_month >= start_month),
  check (
    (transaction_type = 'income' and fund_purpose is null and expense_nature is null and card_id is null)
    or transaction_type = 'expense'
  )
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  effective_date date not null,
  transaction_type public.transaction_type not null,
  name text not null,
  amount bigint not null check (amount >= 0),
  status public.transaction_status not null default 'planned',
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  owner_type public.owner_type not null,
  fund_purpose public.fund_purpose,
  expense_nature public.expense_nature,
  card_id uuid references public.cards(id) on delete set null,
  recurring_rule_id uuid references public.recurring_rules(id) on delete set null,
  recurring_month date,
  applied_rate_rule_id uuid references public.rate_rules(id) on delete set null,
  applied_living_rate_bps integer check (applied_living_rate_bps between 0 and 10000),
  living_allocated_amount bigint check (living_allocated_amount >= 0),
  is_asset_income_snapshot boolean,
  settlement_completed_at timestamptz,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (transaction_type = 'income' and fund_purpose is null and expense_nature is null)
    or (transaction_type = 'expense' and fund_purpose is not null and expense_nature is not null)
    or transaction_type = 'transfer'
  ),
  check (recurring_month is null or date_trunc('month', recurring_month)::date = recurring_month)
);
create unique index transactions_one_occurrence_per_rule_month
  on public.transactions(recurring_rule_id, recurring_month)
  where recurring_rule_id is not null and recurring_month is not null;
create index transactions_household_date_idx on public.transactions(household_id, effective_date);
create index transactions_unsettled_idx on public.transactions(household_id, settlement_completed_at) where settlement_completed_at is null;

create table public.account_reconciliations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  checked_date date not null,
  actual_balance bigint not null,
  ledger_balance bigint not null,
  difference_amount bigint generated always as (actual_balance - ledger_balance) stored,
  memo text,
  created_at timestamptz not null default now()
);

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

create or replace function public.is_household_member(target_household_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
      and hm.is_active
  );
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

create policy households_select on public.households for select using (public.is_household_member(id));
create policy households_update on public.households for update using (public.is_household_member(id));

create policy members_select on public.household_members for select using (public.is_household_member(household_id));

create policy accounts_all on public.accounts for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy rate_rules_all on public.rate_rules for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy categories_all on public.categories for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy cards_all on public.cards for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy recurring_rules_all on public.recurring_rules for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy transactions_all on public.transactions for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy reconciliations_all on public.account_reconciliations for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy snapshots_all on public.monthly_snapshots for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

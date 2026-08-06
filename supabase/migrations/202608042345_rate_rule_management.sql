-- 새 가계에 기본 생활비 반영률 3개를 자동 생성한다.
create or replace function private.insert_default_rate_rules(
  p_household_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_year_start date :=
    make_date(
      extract(
        year from now() at time zone 'Asia/Seoul'
      )::integer,
      1,
      1
    );
begin
  insert into public.rate_rules (
    household_id,
    rule_key,
    name,
    rate_bps,
    valid_from,
    valid_to,
    is_active,
    memo
  )
  select
    p_household_id,
    default_rule.rule_key,
    default_rule.name,
    default_rule.rate_bps,
    v_year_start,
    null,
    true,
    default_rule.memo
  from (
    values
      (
        'default_living'::text,
        '기본 생활비 반영률'::text,
        2820::integer,
        '일반 수입에 적용하는 기본 반영률'::text
      ),
      (
        'full_living'::text,
        '전액 생활비 반영률'::text,
        10000::integer,
        '수입 전액을 생활비로 배정'::text
      ),
      (
        'full_investment'::text,
        '전액 투자 반영률'::text,
        0::integer,
        '수입 전액을 투자 자금으로 배정'::text
      )
  ) as default_rule(
    rule_key,
    name,
    rate_bps,
    memo
  )
  where not exists (
    select 1
    from public.rate_rules existing_rule
    where existing_rule.household_id = p_household_id
      and existing_rule.rule_key =
        default_rule.rule_key
  );
end;
$$;

revoke all
on function private.insert_default_rate_rules(uuid)
from public;


create or replace function private.seed_default_rate_rules()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.insert_default_rate_rules(new.id);

  return new;
end;
$$;

revoke all
on function private.seed_default_rate_rules()
from public;

drop trigger if exists households_seed_default_rate_rules
on public.households;

create trigger households_seed_default_rate_rules
after insert
on public.households
for each row
execute function private.seed_default_rate_rules();


-- 이미 생성된 가계에도 기본 규칙을 넣는다.
do $$
declare
  v_household record;
begin
  for v_household in
    select households.id
    from public.households
  loop
    perform private.insert_default_rate_rules(
      v_household.id
    );
  end loop;
end;
$$;


-- 사용자 정의 반영률 규칙 생성
create or replace function public.create_rate_rule(
  p_household_id uuid,
  p_name text,
  p_rate_bps integer,
  p_valid_from date,
  p_memo text
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_rate_rule_id uuid;
  v_today date :=
    (now() at time zone 'Asia/Seoul')::date;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not private.is_household_member(
    p_household_id
  ) then
    raise exception 'RATE_RULE_ACCESS_DENIED';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'RATE_RULE_NAME_REQUIRED';
  end if;

  if char_length(trim(p_name)) > 50 then
    raise exception 'RATE_RULE_NAME_TOO_LONG';
  end if;

  if p_rate_bps is null
    or p_rate_bps < 0
    or p_rate_bps > 10000
  then
    raise exception 'RATE_RULE_RATE_INVALID';
  end if;

  if p_valid_from is null then
    raise exception 'RATE_RULE_DATE_REQUIRED';
  end if;

  if p_valid_from > v_today then
    raise exception 'RATE_RULE_FUTURE_NOT_ALLOWED';
  end if;

  if exists (
    select 1
    from public.rate_rules
    where household_id = p_household_id
      and valid_to is null
      and lower(name) = lower(trim(p_name))
  ) then
    raise exception 'RATE_RULE_NAME_EXISTS';
  end if;

  insert into public.rate_rules (
    household_id,
    rule_key,
    name,
    rate_bps,
    valid_from,
    valid_to,
    is_active,
    memo
  )
  values (
    p_household_id,
    'custom_' ||
      replace(gen_random_uuid()::text, '-', ''),
    trim(p_name),
    p_rate_bps,
    p_valid_from,
    null,
    true,
    nullif(trim(p_memo), '')
  )
  returning id into v_rate_rule_id;

  return v_rate_rule_id;
end;
$$;

revoke all
on function public.create_rate_rule(
  uuid,
  text,
  integer,
  date,
  text
)
from public;

grant execute
on function public.create_rate_rule(
  uuid,
  text,
  integer,
  date,
  text
)
to authenticated;


-- 반영률을 변경할 때 기존 버전을 종료하고
-- 같은 rule_key의 새 버전을 생성한다.
create or replace function public.create_rate_rule_version(
  p_rate_rule_id uuid,
  p_name text,
  p_rate_bps integer,
  p_valid_from date,
  p_memo text
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_household_id uuid;
  v_rule_key text;
  v_previous_valid_from date;
  v_previous_valid_to date;
  v_new_rate_rule_id uuid;
  v_today date :=
    (now() at time zone 'Asia/Seoul')::date;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select
    rate_rules.household_id,
    rate_rules.rule_key,
    rate_rules.valid_from,
    rate_rules.valid_to
  into
    v_household_id,
    v_rule_key,
    v_previous_valid_from,
    v_previous_valid_to
  from public.rate_rules
  where rate_rules.id = p_rate_rule_id
  for update;

  if not found then
    raise exception 'RATE_RULE_NOT_FOUND';
  end if;

  if not private.is_household_member(
    v_household_id
  ) then
    raise exception 'RATE_RULE_ACCESS_DENIED';
  end if;

  if v_previous_valid_to is not null then
    raise exception 'RATE_RULE_NOT_CURRENT';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'RATE_RULE_NAME_REQUIRED';
  end if;

  if char_length(trim(p_name)) > 50 then
    raise exception 'RATE_RULE_NAME_TOO_LONG';
  end if;

  if p_rate_bps is null
    or p_rate_bps < 0
    or p_rate_bps > 10000
  then
    raise exception 'RATE_RULE_RATE_INVALID';
  end if;

  if p_valid_from is null
    or p_valid_from <= v_previous_valid_from
  then
    raise exception 'RATE_RULE_DATE_INVALID';
  end if;

  if p_valid_from > v_today then
    raise exception 'RATE_RULE_FUTURE_NOT_ALLOWED';
  end if;

  update public.rate_rules
  set
    valid_to = p_valid_from - 1,
    is_active = false
  where id = p_rate_rule_id;

  insert into public.rate_rules (
    household_id,
    rule_key,
    name,
    rate_bps,
    valid_from,
    valid_to,
    is_active,
    memo
  )
  values (
    v_household_id,
    v_rule_key,
    trim(p_name),
    p_rate_bps,
    p_valid_from,
    null,
    true,
    nullif(trim(p_memo), '')
  )
  returning id into v_new_rate_rule_id;

  -- 수입 카테고리는 새 버전을 기본값으로 사용한다.
  update public.categories
  set rate_rule_id = v_new_rate_rule_id
  where household_id = v_household_id
    and rate_rule_id in (
      select previous_rule.id
      from public.rate_rules previous_rule
      where previous_rule.household_id =
        v_household_id
        and previous_rule.rule_key = v_rule_key
        and previous_rule.id <>
          v_new_rate_rule_id
    );

  -- 정기 수입 규칙도 새 버전을 사용한다.
  update public.recurring_rules
  set rate_rule_id = v_new_rate_rule_id
  where household_id = v_household_id
    and rate_rule_id in (
      select previous_rule.id
      from public.rate_rules previous_rule
      where previous_rule.household_id =
        v_household_id
        and previous_rule.rule_key = v_rule_key
        and previous_rule.id <>
          v_new_rate_rule_id
    );

  return v_new_rate_rule_id;
end;
$$;

revoke all
on function public.create_rate_rule_version(
  uuid,
  text,
  integer,
  date,
  text
)
from public;

grant execute
on function public.create_rate_rule_version(
  uuid,
  text,
  integer,
  date,
  text
)
to authenticated;


-- 버전 이력을 우회해서 직접 수정하지 못하게 한다.
revoke insert, update, delete
on public.rate_rules
from authenticated;

grant select
on public.rate_rules
to authenticated;
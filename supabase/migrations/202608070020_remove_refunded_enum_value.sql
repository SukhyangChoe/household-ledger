-- 혹시 남아 있는 환불 상태 거래를 취소로 통합한다.
update public.transactions
set status = 'cancelled'
where status = 'refunded';


-- 이전 마이그레이션에서 추가한 임시 제약조건 제거
alter table public.transactions
drop constraint if exists transactions_status_not_refunded;


-- 기존 enum을 인자로 받는 함수는 타입 교체 전에 제거해야 한다.
drop function if exists public.set_transaction_status(
  uuid,
  public.transaction_status
);


-- status 기본값은 기존 enum 타입에 의존하므로 잠시 제거한다.
alter table public.transactions
alter column status drop default;


-- 기존 enum의 이름을 임시 변경한다.
alter type public.transaction_status
rename to transaction_status_old;


-- refunded가 없는 새 enum 생성
create type public.transaction_status
as enum (
  'planned',
  'confirmed',
  'cancelled'
);


-- transactions.status를 새 enum 타입으로 변환
alter table public.transactions
alter column status
type public.transaction_status
using status::text::public.transaction_status;


-- 기본값 복원
alter table public.transactions
alter column status
set default 'planned'::public.transaction_status;


-- 더 이상 사용하지 않는 기존 enum 제거
drop type public.transaction_status_old;


-- 새 enum 타입을 기준으로 상태 변경 함수 재생성
create or replace function public.set_transaction_status(
  p_transaction_id uuid,
  p_status public.transaction_status
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_household_id uuid;
  v_current_status public.transaction_status;
  v_settlement_completed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select
    transactions.household_id,
    transactions.status,
    transactions.settlement_completed_at
  into
    v_household_id,
    v_current_status,
    v_settlement_completed_at
  from public.transactions
  where transactions.id = p_transaction_id
  for update;

  if not found then
    raise exception 'TRANSACTION_NOT_FOUND';
  end if;

  if not private.is_household_member(
    v_household_id
  ) then
    raise exception 'TRANSACTION_ACCESS_DENIED';
  end if;

  if v_settlement_completed_at is not null then
    raise exception 'TRANSACTION_ALREADY_SETTLED';
  end if;

  if v_current_status = p_status then
    return;
  end if;

  if v_current_status = 'planned'
    and p_status in ('confirmed', 'cancelled')
  then
    update public.transactions
    set status = p_status
    where id = p_transaction_id;

    return;
  end if;

  if v_current_status = 'confirmed'
    and p_status = 'cancelled'
  then
    update public.transactions
    set status = p_status
    where id = p_transaction_id;

    return;
  end if;

  raise exception
    'TRANSACTION_STATUS_TRANSITION_INVALID';
end;
$$;

revoke all
on function public.set_transaction_status(
  uuid,
  public.transaction_status
)
from public;

grant execute
on function public.set_transaction_status(
  uuid,
  public.transaction_status
)
to authenticated;

analyze public.transactions;
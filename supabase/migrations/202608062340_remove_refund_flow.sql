-- 기존 환불 상태 거래가 있다면 취소 상태로 통합한다.
update public.transactions
set status = 'cancelled'
where status = 'refunded';


-- 앱 외부에서 refunded 상태로 직접 변경하는 것도 막는다.
alter table public.transactions
drop constraint if exists transactions_status_not_refunded;

alter table public.transactions
add constraint transactions_status_not_refunded
check (status <> 'refunded');


-- 거래 상태 전환은 예정 → 확정/취소,
-- 확정 → 취소만 허용한다.
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
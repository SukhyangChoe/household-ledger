-- 카드의 결제 계좌가 같은 가계에 속하는지 확인하고,
-- 새로 연결하는 계좌는 활성 계좌만 허용한다.
create or replace function private.validate_card_payment_account()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_is_active boolean;
begin
  select accounts.is_active
  into v_is_active
  from public.accounts
  where accounts.id = new.payment_account_id
    and accounts.household_id = new.household_id;

  if not found then
    raise exception 'CARD_PAYMENT_ACCOUNT_INVALID';
  end if;

  if not v_is_active
    and (
      tg_op = 'INSERT'
      or new.payment_account_id is distinct from old.payment_account_id
      or new.household_id is distinct from old.household_id
    )
  then
    raise exception 'CARD_PAYMENT_ACCOUNT_INACTIVE';
  end if;

  return new;
end;
$$;

revoke all
on function private.validate_card_payment_account()
from public;

drop trigger if exists cards_validate_payment_account
on public.cards;

create trigger cards_validate_payment_account
before insert or update of household_id, payment_account_id
on public.cards
for each row
execute function private.validate_card_payment_account();


-- 직접 DELETE는 막고 검증 함수로만 삭제한다.
revoke delete
on public.cards
from authenticated;

create or replace function public.delete_unused_card(
  p_card_id uuid
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

  select cards.household_id
  into v_household_id
  from public.cards
  where cards.id = p_card_id;

  if not found then
    raise exception 'CARD_NOT_FOUND';
  end if;

  if not private.is_household_member(v_household_id) then
    raise exception 'CARD_ACCESS_DENIED';
  end if;

  if exists (
    select 1
    from public.recurring_rules
    where recurring_rules.card_id = p_card_id
  ) then
    raise exception 'CARD_IN_USE';
  end if;

  if exists (
    select 1
    from public.transactions
    where transactions.card_id = p_card_id
  ) then
    raise exception 'CARD_IN_USE';
  end if;

  delete from public.cards
  where cards.id = p_card_id
    and cards.household_id = v_household_id;

  if not found then
    raise exception 'CARD_DELETE_FAILED';
  end if;
end;
$$;

revoke all
on function public.delete_unused_card(uuid)
from public;

grant execute
on function public.delete_unused_card(uuid)
to authenticated;
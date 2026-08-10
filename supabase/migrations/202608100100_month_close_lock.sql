-- 월 마감 이후 과거 장부의 재무 값이 변하지 않도록 잠근다.
-- 단, 과거 월 거래의 정산은 다음 열린 월에서 완료할 수 있으므로
-- settlement_completed_at 자체는 정산이 발생한 월이 열려 있을 때만 변경을 허용한다.

create or replace function private.is_month_closed(
  p_household_id uuid,
  p_date date
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.monthly_snapshots
    where monthly_snapshots.household_id = p_household_id
      and monthly_snapshots.snapshot_month =
        date_trunc('month', p_date)::date
  );
$$;

revoke all
on function private.is_month_closed(uuid, date)
from public;

create or replace function private.prevent_closed_month_transaction_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_old_month_closed boolean := false;
  v_new_month_closed boolean := false;
  v_old_settlement_month_closed boolean := false;
  v_new_settlement_month_closed boolean := false;
  v_old_settlement_date date;
  v_new_settlement_date date;
begin
  if tg_op = 'INSERT' then
    v_new_month_closed := private.is_month_closed(
      new.household_id,
      new.effective_date
    );

    if v_new_month_closed then
      -- 마감된 월을 다시 조회할 때 정기 거래 생성 RPC가 오류를 내지 않도록
      -- 정기 규칙 기반 자동 생성 시도는 조용히 건너뛴다.
      if new.recurring_rule_id is not null then
        return null;
      end if;

      raise exception 'MONTH_CLOSED';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if private.is_month_closed(
      old.household_id,
      old.effective_date
    ) then
      raise exception 'MONTH_CLOSED';
    end if;

    return old;
  end if;

  -- 아래 필드만 달라졌다면 재무 내용 변경이 아니다.
  -- summary group snapshot은 과거 미분류 카테고리의 최초 분류 보정을 허용한다.
  if (
    (
      to_jsonb(new)
      - 'settlement_completed_at'
      - 'updated_at'
      - 'expense_summary_group_snapshot'
      - 'income_summary_group_snapshot'
    )
    is distinct from
    (
      to_jsonb(old)
      - 'settlement_completed_at'
      - 'updated_at'
      - 'expense_summary_group_snapshot'
      - 'income_summary_group_snapshot'
    )
  ) then
    v_old_month_closed := private.is_month_closed(
      old.household_id,
      old.effective_date
    );
    v_new_month_closed := private.is_month_closed(
      new.household_id,
      new.effective_date
    );

    if v_old_month_closed or v_new_month_closed then
      raise exception 'MONTH_CLOSED';
    end if;

    -- 거래 금액/계좌/목적 등이 바뀌면 이미 정산 완료된 금액도 달라질 수 있다.
    -- 따라서 정산이 반영된 월이 이미 마감된 경우에도 재무값 변경을 막는다.
    if old.settlement_completed_at is not null then
      v_old_settlement_date :=
        (old.settlement_completed_at at time zone 'Asia/Seoul')::date;

      if private.is_month_closed(
        old.household_id,
        v_old_settlement_date
      ) then
        raise exception 'SETTLEMENT_MONTH_CLOSED';
      end if;
    end if;

    if new.settlement_completed_at is not null then
      v_new_settlement_date :=
        (new.settlement_completed_at at time zone 'Asia/Seoul')::date;

      if private.is_month_closed(
        new.household_id,
        v_new_settlement_date
      ) then
        raise exception 'SETTLEMENT_MONTH_CLOSED';
      end if;
    end if;
  end if;

  if new.settlement_completed_at
      is distinct from old.settlement_completed_at
  then
    if old.settlement_completed_at is not null then
      v_old_settlement_date :=
        (old.settlement_completed_at at time zone 'Asia/Seoul')::date;

      v_old_settlement_month_closed :=
        private.is_month_closed(
          old.household_id,
          v_old_settlement_date
        );
    end if;

    if new.settlement_completed_at is not null then
      v_new_settlement_date :=
        (new.settlement_completed_at at time zone 'Asia/Seoul')::date;

      v_new_settlement_month_closed :=
        private.is_month_closed(
          new.household_id,
          v_new_settlement_date
        );
    end if;

    if v_old_settlement_month_closed
      or v_new_settlement_month_closed
    then
      raise exception 'SETTLEMENT_MONTH_CLOSED';
    end if;
  end if;

  return new;
end;
$$;

revoke all
on function private.prevent_closed_month_transaction_mutation()
from public;

drop trigger if exists transactions_block_closed_month
on public.transactions;

create trigger transactions_block_closed_month
before insert or update or delete
on public.transactions
for each row
execute function private.prevent_closed_month_transaction_mutation();


create or replace function private.prevent_closed_month_reconciliation_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if private.is_month_closed(
      old.household_id,
      old.checked_date
    ) then
      raise exception 'RECONCILIATION_MONTH_CLOSED';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if private.is_month_closed(
      new.household_id,
      new.checked_date
    ) then
      raise exception 'RECONCILIATION_MONTH_CLOSED';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all
on function private.prevent_closed_month_reconciliation_mutation()
from public;

drop trigger if exists reconciliations_block_closed_month
on public.account_reconciliations;

create trigger reconciliations_block_closed_month
before insert or update or delete
on public.account_reconciliations
for each row
execute function private.prevent_closed_month_reconciliation_mutation();

comment on function private.is_month_closed(uuid, date) is
  '해당 household/date가 monthly_snapshots로 마감된 월인지 확인';

comment on function private.prevent_closed_month_transaction_mutation() is
  '마감 월 거래 재무값 잠금. 정산은 정산 발생 월이 열려 있을 때만 허용';

comment on function private.prevent_closed_month_reconciliation_mutation() is
  '마감 월의 계좌 대조 기록 변경 방지';

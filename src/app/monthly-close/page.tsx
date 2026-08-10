import Link from "next/link";

import {
  Card,
  MoneyRow,
} from "@/components/ui";
import {
  buildMonthlySnapshotValues,
  monthEndDate,
} from "@/domain/monthly-close";
import { calculateLivingAccountLedgerBalance } from "@/domain/reconciliation";
import { buildSettlementItems } from "@/domain/settlement";
import { requireCurrentHousehold } from "@/lib/household/current";
import { MonthlyCloseManager } from "@/app/monthly-close/monthly-close-manager";

export const dynamic =
  "force-dynamic";

function getCurrentMonthInKorea() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
      },
    ).formatToParts(new Date());

  const year = parts.find(
    (part) =>
      part.type === "year",
  )?.value;
  const month = parts.find(
    (part) =>
      part.type === "month",
  )?.value;

  if (!year || !month) {
    throw new Error(
      "현재 월을 확인하지 못했습니다.",
    );
  }

  return `${year}-${month}`;
}

function shiftMonth(
  monthValue: string,
  offset: number,
) {
  const [year, month] =
    monthValue
      .split("-")
      .map(Number);

  const shifted = new Date(
    Date.UTC(
      year,
      month - 1 + offset,
      1,
    ),
  );

  return `${shifted.getUTCFullYear()}-${String(
    shifted.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

function normalizeMonth(
  value: string | undefined,
  fallbackMonth: string,
) {
  if (
    !value ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(
      value,
    )
  ) {
    return fallbackMonth;
  }

  return value;
}

function monthLabel(
  value: string,
) {
  const [year, month] =
    value
      .split("-")
      .map(Number);

  return `${year}년 ${month}월`;
}

function won(value: number) {
  return `${value.toLocaleString(
    "ko-KR",
  )}원`;
}

function signedWon(
  value: number,
) {
  if (value === 0) {
    return "0원";
  }

  return `${
    value > 0 ? "+" : ""
  }${won(value)}`;
}

function rateText(
  value: number | null,
) {
  if (value === null) {
    return "-";
  }

  return `${(
    value / 100
  ).toFixed(1)}%`;
}

type MonthlyClosePageProps = {
  searchParams: Promise<{
    month?: string;
  }>;
};

export default async function MonthlyClosePage({
  searchParams,
}: MonthlyClosePageProps) {
  const currentMonth =
    getCurrentMonthInKorea();
  const defaultMonth =
    shiftMonth(
      currentMonth,
      -1,
    );

  const params =
    await searchParams;
  const requestedMonth =
    normalizeMonth(
      params.month,
      defaultMonth,
    );
  const month =
    requestedMonth > currentMonth
      ? currentMonth
      : requestedMonth;

  const previousMonth =
    shiftMonth(month, -1);
  const nextMonth =
    shiftMonth(month, 1);
  const snapshotMonth =
    `${month}-01`;
  const nextMonthStart =
    `${nextMonth}-01`;
  const monthEnd =
    monthEndDate(month);

  const {
    supabase,
    householdId,
  } =
    await requireCurrentHousehold();

  const [
    snapshotHistoryResult,
    accountsResult,
  ] = await Promise.all([
    supabase
      .from(
        "monthly_snapshots",
      )
      .select("*")
      .eq(
        "household_id",
        householdId,
      )
      .order(
        "snapshot_month",
        {
          ascending: false,
        },
      ),

    supabase
      .from("accounts")
      .select(
        "id, name, is_living_account",
      )
      .eq(
        "household_id",
        householdId,
      )
      .order("name", {
        ascending: true,
      }),
  ]);

  if (
    snapshotHistoryResult.error
  ) {
    console.error(
      "Failed to load monthly snapshot history:",
      snapshotHistoryResult.error,
    );

    throw new Error(
      "월 마감 이력을 불러오지 못했습니다.",
    );
  }

  if (accountsResult.error) {
    console.error(
      "Failed to load monthly close accounts:",
      accountsResult.error,
    );

    throw new Error(
      "계좌 정보를 불러오지 못했습니다.",
    );
  }

  const snapshotHistory =
    snapshotHistoryResult.data ??
    [];

  const closedSnapshot =
    snapshotHistory.find(
      (snapshot) =>
        snapshot.snapshot_month ===
        snapshotMonth,
    ) ?? null;

  if (!closedSnapshot) {
    const {
      error: generationError,
    } = await supabase.rpc(
      "generate_recurring_transactions",
      {
        p_household_id:
          householdId,
        p_target_month:
          snapshotMonth,
      },
    );

    if (generationError) {
      console.error(
        "Failed to generate recurring transactions for monthly close preview:",
        generationError,
      );

      throw new Error(
        "선택한 달의 정기 거래를 확인하지 못했습니다.",
      );
    }
  }

  const accounts =
    accountsResult.data ?? [];
  const livingAccount =
    accounts.find(
      (account) =>
        account.is_living_account,
    ) ?? null;

  const [
    monthTransactionsResult,
    ledgerTransactionsResult,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, effective_date, transaction_type, name, amount, status, account_id, fund_purpose, expense_nature, living_allocated_amount, is_asset_income_snapshot, settlement_completed_at",
      )
      .eq(
        "household_id",
        householdId,
      )
      .in("status", [
        "planned",
        "confirmed",
      ])
      .in(
        "transaction_type",
        ["income", "expense"],
      )
      .gte(
        "effective_date",
        snapshotMonth,
      )
      .lt(
        "effective_date",
        nextMonthStart,
      ),

    supabase
      .from("transactions")
      .select(
        "effective_date, transaction_type, amount, status, account_id, fund_purpose, living_allocated_amount, settlement_completed_at",
      )
      .eq(
        "household_id",
        householdId,
      )
      .eq(
        "status",
        "confirmed",
      )
      .in(
        "transaction_type",
        ["income", "expense"],
      )
      .lte(
        "effective_date",
        monthEnd,
      ),
  ]);

  let baseline:
    | {
        checked_date: string;
        actual_balance: number;
      }
    | null = null;

  let baselineError:
    | {
        message: string;
      }
    | null = null;

  if (livingAccount) {
    const result =
      await supabase
        .from(
          "account_reconciliations",
        )
        .select(
          "checked_date, actual_balance",
        )
        .eq(
          "household_id",
          householdId,
        )
        .eq(
          "account_id",
          livingAccount.id,
        )
        .lte(
          "checked_date",
          monthEnd,
        )
        .order(
          "checked_date",
          {
            ascending: false,
          },
        )
        .limit(1)
        .maybeSingle();

    baseline =
      result.data;
    baselineError =
      result.error;
  }

  const firstError =
    monthTransactionsResult.error ??
    baselineError ??
    ledgerTransactionsResult.error;

  if (firstError) {
    console.error(
      "Failed to load monthly close preview inputs:",
      firstError,
    );

    throw new Error(
      "월 마감 계산에 필요한 데이터를 불러오지 못했습니다.",
    );
  }

  const monthTransactions =
    monthTransactionsResult.data ??
    [];
  const plannedCount =
    monthTransactions.filter(
      (transaction) =>
        transaction.status ===
        "planned",
    ).length;

  const settlementResult =
    buildSettlementItems(
      monthTransactions,
      accounts,
    );

  const unsettledCount =
    settlementResult.items.filter(
      (item) =>
        item.completedAt ===
        null,
    ).length;

  const ledgerBalance =
    livingAccount &&
    baseline
      ? calculateLivingAccountLedgerBalance(
          {
            baselineActualBalance:
              baseline.actual_balance,
            baselineDate:
              baseline.checked_date,
            targetDate:
              monthEnd,
            livingAccountId:
              livingAccount.id,
            transactions:
              ledgerTransactionsResult.data ??
              [],
          },
        )
      : null;

  const liveSnapshot =
    ledgerBalance !== null
      ? buildMonthlySnapshotValues(
          {
            transactions:
              monthTransactions,
            livingAccountLedgerBalance:
              ledgerBalance,
            livingAccountActualBalance:
              baseline?.checked_date ===
              monthEnd
                ? baseline.actual_balance
                : null,
            unsettledCount,
          },
        )
      : null;

  const displaySnapshot =
    closedSnapshot ??
    liveSnapshot;

  let disabledReason:
    string | null = null;

  if (!closedSnapshot) {
    if (month >= currentMonth) {
      disabledReason =
        "현재 월은 아직 진행 중입니다. 다음 달부터 마감할 수 있습니다.";
    } else if (!livingAccount) {
      disabledReason =
        "생활비 계좌를 먼저 지정해주세요.";
    } else if (
      plannedCount > 0
    ) {
      disabledReason =
        `예정 거래 ${plannedCount}건이 남아 있습니다. 월별 가계부에서 확정 또는 취소해주세요.`;
    } else if (!baseline) {
      disabledReason =
        `${monthEnd} 이전에 저장된 잔액 대조 기준점이 필요합니다.`;
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            월 마감
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            한 달의 확정 거래와
            생활비 계좌 상태를
            snapshot으로 저장해
            과거 장부를 확정합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/monthly-close?month=${previousMonth}`}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"
          >
            ←
          </Link>

          <span className="min-w-28 text-center text-sm font-semibold">
            {monthLabel(
              month,
            )}
          </span>

          {nextMonth <=
          currentMonth ? (
            <Link
              href={`/monthly-close?month=${nextMonth}`}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"
            >
              →
            </Link>
          ) : (
            <span className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-gray-300">
              →
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          title="마감 상태"
          value={
            closedSnapshot
              ? "마감 완료"
              : "마감 전"
          }
          sub={
            closedSnapshot
              ? `마감 시각 ${new Date(
                  closedSnapshot.closed_at,
                ).toLocaleString(
                  "ko-KR",
                  {
                    timeZone:
                      "Asia/Seoul",
                  },
                )}`
              : plannedCount > 0
                ? `예정 거래 ${plannedCount}건 남음`
                : "확정 거래 기준 미리보기"
          }
        />

        <Card
          title="확정 수입"
          value={
            displaySnapshot
              ? won(
                  displaySnapshot.confirmed_income,
                )
              : "-"
          }
          sub={
            displaySnapshot
              ? `생활비 배정 ${won(
                  displaySnapshot.living_allocated_amount,
                )}`
              : "계산 준비 필요"
          }
        />

        <Card
          title="생활비 사용"
          value={
            displaySnapshot
              ? won(
                  displaySnapshot.living_expense_amount,
                )
              : "-"
          }
          sub={
            displaySnapshot
              ? `잔액 ${signedWon(
                  displaySnapshot.living_budget_balance,
                )}`
              : "계산 준비 필요"
          }
        />

        <Card
          title="미정산 거래"
          value={
            displaySnapshot
              ? `${displaySnapshot.unsettled_count}건`
              : "-"
          }
          sub={
            closedSnapshot
              ? "마감 당시 미정산 건수"
              : "현재 선택 월의 미정산 건수"
          }
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="월 마감 집계">
          {displaySnapshot ? (
            <div className="mt-3 divide-y divide-[var(--border)]">
              <MoneyRow
                label="확정 수입"
                value={won(
                  displaySnapshot.confirmed_income,
                )}
              />
              <MoneyRow
                label="생활비 배정"
                value={won(
                  displaySnapshot.living_allocated_amount,
                )}
              />
              <MoneyRow
                label="생활비 지출"
                value={won(
                  displaySnapshot.living_expense_amount,
                )}
              />
              <MoneyRow
                label="투자 지출"
                value={won(
                  displaySnapshot.investment_expense_amount,
                )}
              />
              <MoneyRow
                label="생활비 고정지출"
                value={won(
                  displaySnapshot.living_fixed_expense_amount,
                )}
              />
              <MoneyRow
                label="투자 고정지출"
                value={won(
                  displaySnapshot.investment_fixed_expense_amount,
                )}
              />
              <MoneyRow
                label="자산소득"
                value={won(
                  displaySnapshot.asset_income_amount,
                )}
              />
              <MoneyRow
                label="고정지출 충당률"
                value={rateText(
                  displaySnapshot.fixed_coverage_rate_bps,
                )}
              />
              <MoneyRow
                label="생활비 예산 잔액"
                value={signedWon(
                  displaySnapshot.living_budget_balance,
                )}
                strong
              />
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              월 마감 집계를 계산할
              수 있는 잔액 대조
              기준점이 아직 없습니다.
            </div>
          )}
        </Card>

        <Card title="생활비 계좌 월말 상태">
          {displaySnapshot ? (
            <div className="mt-3 divide-y divide-[var(--border)]">
              <MoneyRow
                label="프로그램 월말 장부 잔액"
                value={won(
                  displaySnapshot.living_account_ledger_balance,
                )}
              />
              <MoneyRow
                label="월말 실제 잔액"
                value={
                  displaySnapshot.living_account_actual_balance ===
                  null
                    ? "미대조"
                    : won(
                        displaySnapshot.living_account_actual_balance,
                      )
                }
              />
              <MoneyRow
                label="월말 대조 차이"
                value={
                  displaySnapshot.living_account_actual_balance ===
                  null
                    ? "-"
                    : signedWon(
                        displaySnapshot.living_account_actual_balance -
                          displaySnapshot.living_account_ledger_balance,
                      )
                }
                strong
              />
            </div>
          ) : null}

          {!closedSnapshot &&
          baseline &&
          baseline.checked_date !==
            monthEnd ? (
            <p className="mt-4 text-xs leading-5 text-gray-500">
              월말({monthEnd})에 직접
              잔액을 대조한 기록이
              없어서 실제 잔액은
              snapshot에 비워둡니다.
              프로그램 장부 잔액은
              {` ${baseline.checked_date} `}
              실제 잔액을 기준으로
              월말까지 계산합니다.
            </p>
          ) : null}

          {!baseline &&
          !closedSnapshot ? (
            <Link
              href="/reconciliation"
              className="mt-4 inline-flex rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold"
            >
              잔액 대조로 이동
            </Link>
          ) : null}
        </Card>
      </div>

      <Card
        title={
          closedSnapshot
            ? "마감 관리"
            : "월 마감 실행"
        }
      >
        <MonthlyCloseManager
          month={month}
          isClosed={
            closedSnapshot !==
            null
          }
          disabledReason={
            disabledReason
          }
        />
      </Card>

      <Card title="최근 월 마감 이력">
        {snapshotHistory.length ===
        0 ? (
          <div className="mt-4 rounded-xl bg-gray-50 p-5 text-center text-sm text-gray-500">
            아직 마감된 월이
            없습니다.
          </div>
        ) : (
          <div className="mt-3 divide-y divide-[var(--border)]">
            {snapshotHistory
              .slice(0, 12)
              .map(
                (snapshot) => (
                  <Link
                    key={
                      snapshot.id
                    }
                    href={`/monthly-close?month=${snapshot.snapshot_month.slice(
                      0,
                      7,
                    )}`}
                    className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-[var(--surface-soft)]"
                  >
                    <span className="font-semibold">
                      {monthLabel(
                        snapshot.snapshot_month.slice(
                          0,
                          7,
                        ),
                      )}
                    </span>

                    <span className="text-right text-xs text-gray-500">
                      확정 수입{" "}
                      {won(
                        snapshot.confirmed_income,
                      )}
                      {" · "}
                      미정산{" "}
                      {
                        snapshot.unsettled_count
                      }
                      건
                    </span>
                  </Link>
                ),
              )}
          </div>
        )}
      </Card>
    </div>
  );
}

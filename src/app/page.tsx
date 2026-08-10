import Link from "next/link";

import {
  Badge,
  Card,
  MoneyRow,
} from "@/components/ui";
import {
  buildDashboardSummary,
} from "@/domain/dashboard";
import {
  buildSettlementItems,
  isSettlementIntoLivingAccount,
  isSettlementOutOfLivingAccount,
} from "@/domain/settlement";
import { requireCurrentHousehold } from "@/lib/household/current";

export const dynamic = "force-dynamic";

function getCurrentMonthInKorea() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year",
  )?.value;
  const month = parts.find(
    (part) => part.type === "month",
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
  const [year, month] = monthValue
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

function monthLabel(value: string) {
  const [year, month] = value
    .split("-")
    .map(Number);

  return `${year}년 ${month}월`;
}

function won(value: number) {
  return `${value.toLocaleString(
    "ko-KR",
  )}원`;
}

function signedWon(value: number) {
  if (value === 0) {
    return "0원";
  }

  return `${value > 0 ? "+" : ""}${won(
    value,
  )}`;
}

function rateText(
  rateBps: number | null,
) {
  if (rateBps === null) {
    return "-";
  }

  return `${(
    rateBps / 100
  ).toFixed(1)}%`;
}

function fixedCoverageSub({
  fixedExpenseAmount,
  fixedCoverageDifference,
}: {
  fixedExpenseAmount: number;
  fixedCoverageDifference: number;
}) {
  if (fixedExpenseAmount === 0) {
    return "이번 달 확정 고정지출이 없습니다.";
  }

  if (fixedCoverageDifference === 0) {
    return "자산소득과 고정지출 금액이 같습니다.";
  }

  if (fixedCoverageDifference > 0) {
    return `자산소득이 고정지출보다 ${won(
      fixedCoverageDifference,
    )} 많음`;
  }

  return `자산소득이 고정지출보다 ${won(
    Math.abs(
      fixedCoverageDifference,
    ),
  )} 부족`;
}

export default async function DashboardPage() {
  const currentMonth =
    getCurrentMonthInKorea();
  const startDate =
    `${currentMonth}-01`;
  const nextMonth = shiftMonth(
    currentMonth,
    1,
  );
  const nextMonthStart =
    `${nextMonth}-01`;

  const {
    supabase,
    householdId,
  } = await requireCurrentHousehold();

  const {
    error: generationError,
  } = await supabase.rpc(
    "generate_recurring_transactions",
    {
      p_household_id: householdId,
      p_target_month: startDate,
    },
  );

  if (generationError) {
    console.error(
      "Failed to generate recurring transactions for dashboard:",
      generationError,
    );

    throw new Error(
      "이번 달 정기 거래를 생성하지 못했습니다.",
    );
  }

  const [
    accountsResult,
    transactionsResult,
  ] = await Promise.all([
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
        startDate,
      )
      .lt(
        "effective_date",
        nextMonthStart,
      )
      .order(
        "effective_date",
        {
          ascending: true,
        },
      )
      .order("created_at", {
        ascending: true,
      }),
  ]);

  if (accountsResult.error) {
    console.error(
      "Failed to load dashboard accounts:",
      accountsResult.error,
    );

    throw new Error(
      "계좌 정보를 불러오지 못했습니다.",
    );
  }

  if (transactionsResult.error) {
    console.error(
      "Failed to load dashboard transactions:",
      transactionsResult.error,
    );

    throw new Error(
      "이번 달 거래를 불러오지 못했습니다.",
    );
  }

  const accounts =
    accountsResult.data ?? [];
  const transactions =
    transactionsResult.data ?? [];

  const summary =
    buildDashboardSummary(
      transactions,
    );

  const settlementResult =
    buildSettlementItems(
      transactions,
      accounts,
    );

  const pendingSettlementItems =
    settlementResult.items.filter(
      (item) =>
        item.completedAt === null,
    );

  const settlementIntoLiving =
    pendingSettlementItems
      .filter((item) =>
        isSettlementIntoLivingAccount(
          item.direction,
        ),
      )
      .reduce(
        (sum, item) =>
          sum + item.amount,
        0,
      );

  const settlementOutOfLiving =
    pendingSettlementItems
      .filter((item) =>
        isSettlementOutOfLivingAccount(
          item.direction,
        ),
      )
      .reduce(
        (sum, item) =>
          sum + item.amount,
        0,
      );

  const livingAccount =
    settlementResult.livingAccount;

  const latestReconciliation =
    livingAccount
      ? await supabase
          .from(
            "account_reconciliations",
          )
          .select(
            "checked_date, actual_balance, ledger_balance, difference_amount",
          )
          .eq(
            "household_id",
            householdId,
          )
          .eq(
            "account_id",
            livingAccount.id,
          )
          .order(
            "checked_date",
            {
              ascending: false,
            },
          )
          .limit(1)
          .maybeSingle()
      : null;

  if (
    latestReconciliation?.error
  ) {
    console.error(
      "Failed to load latest reconciliation:",
      latestReconciliation.error,
    );

    throw new Error(
      "생활비 계좌 대조 정보를 불러오지 못했습니다.",
    );
  }

  const reconciliation =
    latestReconciliation?.data ??
    null;

  const reconciliationDifference =
    reconciliation
      ? reconciliation
          .difference_amount ??
        reconciliation.actual_balance -
          reconciliation.ledger_balance
      : null;

  const statusBadge =
    !livingAccount ? (
      <Badge tone="warn">
        생활비 계좌 설정 필요
      </Badge>
    ) : !reconciliation ? (
      <Badge tone="warn">
        잔액 대조 전
      </Badge>
    ) : reconciliationDifference ===
      0 ? (
      <Badge tone="good">
        최근 잔액 대조 일치
      </Badge>
    ) : (
      <Badge tone="warn">
        최근 대조 차이{" "}
        {signedWon(
          reconciliationDifference ??
            0,
        )}
      </Badge>
    );

  const visibleSettlementItems =
    pendingSettlementItems.slice(
      0,
      5,
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            이번 달 한눈에 보기
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {monthLabel(
              currentMonth,
            )} 확정 거래와 예정
            거래를 기준으로 계산합니다.
          </p>
        </div>

        {statusBadge}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card
          title="확정 수입"
          value={won(
            summary.confirmedIncome,
          )}
          sub={`남은 예정 수입 ${won(
            summary.plannedIncome,
          )}`}
        />

        <Card
          title="생활비 배정"
          value={won(
            summary.livingAllocatedAmount,
          )}
          sub="확정 수입에 저장된 생활비 반영액 합계"
        />

        <Card
          title="생활비 사용"
          value={won(
            summary.livingExpenseAmount,
          )}
          sub={`예산 잔액 ${won(
            summary.livingBudgetBalance,
          )} · 사용률 ${rateText(
            summary.livingUsageRateBps,
          )}`}
        />

        <Card
          title="투자 가능액"
          value={won(
            summary.investmentAvailableAmount,
          )}
          sub={`투자 목적 지출 ${won(
            summary.investmentExpenseAmount,
          )} 차감 후`}
        />

        <Card
          title="고정지출 충당률"
          value={rateText(
            summary.fixedCoverageRateBps,
          )}
          sub={fixedCoverageSub({
            fixedExpenseAmount:
              summary.fixedExpenseAmount,
            fixedCoverageDifference:
              summary.fixedCoverageDifference,
          })}
        />

        <Card
          title="생활비 계좌"
          value={
            reconciliation
              ? won(
                  reconciliation.actual_balance,
                )
              : livingAccount
                ? "잔액 대조 전"
                : "설정 필요"
          }
          sub={
            reconciliation &&
            livingAccount
              ? `${livingAccount.name} · 최근 대조 ${reconciliation.checked_date}`
              : livingAccount
                ? `${livingAccount.name} · 아직 잔액 대조 기록 없음`
                : "설정에서 생활비 계좌를 지정해주세요."
          }
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card title="이번 달 필요한 이체">
          {livingAccount ? (
            <>
              {visibleSettlementItems.length ===
              0 ? (
                <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                  현재 미정산 거래가
                  없습니다.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {visibleSettlementItems.map(
                    (item) => (
                      <div
                        key={
                          item.transactionId
                        }
                        className="rounded-xl border border-[var(--border)] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {
                                item.name
                              }
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {
                                item.directionText
                              }
                            </p>
                          </div>

                          <strong>
                            {won(
                              item.amount,
                            )}
                          </strong>
                        </div>
                      </div>
                    ),
                  )}

                  {pendingSettlementItems.length >
                  visibleSettlementItems.length ? (
                    <p className="text-center text-xs text-gray-500">
                      외{" "}
                      {pendingSettlementItems.length -
                        visibleSettlementItems.length}
                      건의 미정산 거래가
                      있습니다.
                    </p>
                  ) : null}
                </div>
              )}

              <Link
                href={`/settlements?month=${currentMonth}`}
                className="mt-4 flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
              >
                생활비 정산으로 이동
              </Link>
            </>
          ) : (
            <>
              <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                필요한 이체를
                계산하려면 생활비
                계좌를 먼저
                지정해주세요.
              </div>

              <Link
                href="/settings/accounts"
                className="mt-4 flex w-full items-center justify-center rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold"
              >
                카드/계좌 설정으로 이동
              </Link>
            </>
          )}
        </Card>

        <Card title="생활비 계좌 대조">
          {livingAccount ? (
            <>
              <div className="mt-3 divide-y divide-[var(--border)]">
                <MoneyRow
                  label="생활비 계좌"
                  value={
                    livingAccount.name
                  }
                />

                <MoneyRow
                  label="최근 실제 잔액"
                  value={
                    reconciliation
                      ? won(
                          reconciliation.actual_balance,
                        )
                      : "-"
                  }
                />

                <MoneyRow
                  label="최근 장부 잔액"
                  value={
                    reconciliation
                      ? won(
                          reconciliation.ledger_balance,
                        )
                      : "-"
                  }
                />

                <MoneyRow
                  label="최근 대조 차이"
                  value={
                    reconciliationDifference ===
                    null
                      ? "-"
                      : signedWon(
                          reconciliationDifference,
                        )
                  }
                />

                <MoneyRow
                  label="아직 받을 금액"
                  value={`+${won(
                    settlementIntoLiving,
                  )}`}
                />

                <MoneyRow
                  label="아직 보낼 금액"
                  value={`-${won(
                    settlementOutOfLiving,
                  )}`}
                />

                <MoneyRow
                  label="정산 순액"
                  value={signedWon(
                    settlementIntoLiving -
                      settlementOutOfLiving,
                  )}
                  strong
                />
              </div>

              <p className="mt-4 text-xs leading-5 text-gray-500">
                잔액은 가장 최근에 저장된
                계좌 대조 기록입니다. 실제
                잔액 입력과 새 대조 생성은
                잔액 대조 화면에서
                관리합니다.
              </p>

              <Link
                href="/reconciliation"
                className="mt-4 flex w-full items-center justify-center rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold"
              >
                잔액 대조로 이동
              </Link>
            </>
          ) : (
            <>
              <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                생활비 계좌가 아직
                지정되지 않았습니다.
              </div>

              <Link
                href="/settings/accounts"
                className="mt-4 flex w-full items-center justify-center rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold"
              >
                카드/계좌 설정으로 이동
              </Link>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

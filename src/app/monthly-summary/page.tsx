import Link from "next/link";

import {
  Card,
  MoneyRow,
} from "@/components/ui";
import {
  amountChange,
  buildYearSummary,
  filterSnapshotsByYear,
  latestTwoSnapshots,
  maxTrendValue,
  snapshotMonthNumber,
  trendWidthPercent,
} from "@/domain/monthly-summary";
import { requireCurrentHousehold } from "@/lib/household/current";

export const dynamic =
  "force-dynamic";

function getCurrentYearInKorea() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
      },
    ).formatToParts(new Date());

  const year = parts.find(
    (part) =>
      part.type === "year",
  )?.value;

  if (!year) {
    throw new Error(
      "현재 연도를 확인하지 못했습니다.",
    );
  }

  return Number(year);
}

function normalizeYear(
  value: string | undefined,
  fallbackYear: number,
) {
  if (
    !value ||
    !/^\d{4}$/.test(value)
  ) {
    return fallbackYear;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 2000 ||
    parsed > 2100
  ) {
    return fallbackYear;
  }

  return parsed;
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

function monthText(
  snapshotMonth: string,
) {
  return `${Number(
    snapshotMonth.slice(5, 7),
  )}월`;
}

function changeDescription({
  value,
  decreaseIsGood = false,
}: {
  value: number | null;
  decreaseIsGood?: boolean;
}) {
  if (value === null) {
    return "비교할 이전 마감 월이 없습니다.";
  }

  if (value === 0) {
    return "이전 마감 월과 같습니다.";
  }

  const direction =
    value > 0 ? "증가" : "감소";

  const good =
    decreaseIsGood
      ? value < 0
      : value > 0;

  return `이전 마감 월보다 ${won(
    Math.abs(value),
  )} ${direction}${
    good ? "" : ""
  }`;
}

function countChangeDescription(
  value: number | null,
) {
  if (value === null) {
    return "비교할 이전 마감 월이 없습니다.";
  }

  if (value === 0) {
    return "이전 마감 월과 같습니다.";
  }

  return `이전 마감 월보다 ${Math.abs(
    value,
  )}건 ${
    value > 0 ? "증가" : "감소"
  }`;
}

type MonthlySummaryPageProps = {
  searchParams: Promise<{
    year?: string;
  }>;
};

export default async function MonthlySummaryPage({
  searchParams,
}: MonthlySummaryPageProps) {
  const {
    supabase,
    householdId,
  } =
    await requireCurrentHousehold();

  const {
    data: snapshots,
    error,
  } = await supabase
    .from("monthly_snapshots")
    .select("*")
    .eq(
      "household_id",
      householdId,
    )
    .order(
      "snapshot_month",
      {
        ascending: true,
      },
    );

  if (error) {
    console.error(
      "Failed to load monthly summaries:",
      error,
    );

    throw new Error(
      "월별 정리 데이터를 불러오지 못했습니다.",
    );
  }

  const allSnapshots =
    snapshots ?? [];

  const currentYear =
    getCurrentYearInKorea();

  const latestSnapshot =
    allSnapshots.at(-1) ??
    null;

  const fallbackYear =
    latestSnapshot
      ? Number(
          latestSnapshot.snapshot_month.slice(
            0,
            4,
          ),
        )
      : currentYear;

  const params =
    await searchParams;
  const year =
    normalizeYear(
      params.year,
      fallbackYear,
    );

  const yearSnapshots =
    filterSnapshotsByYear(
      allSnapshots,
      year,
    );

  const yearSummary =
    buildYearSummary(
      yearSnapshots,
    );

  const {
    latest,
    previous,
  } =
    latestTwoSnapshots(
      yearSnapshots,
    );

  const livingExpenseChange =
    latest && previous
      ? amountChange(
          latest.living_expense_amount,
          previous.living_expense_amount,
        )
      : null;

  const investmentExpenseChange =
    latest && previous
      ? amountChange(
          latest.investment_expense_amount,
          previous.investment_expense_amount,
        )
      : null;

  const budgetBalanceChange =
    latest && previous
      ? amountChange(
          latest.living_budget_balance,
          previous.living_budget_balance,
        )
      : null;

  const unsettledChange =
    latest && previous
      ? latest.unsettled_count -
        previous.unsettled_count
      : null;

  const trendMax =
    maxTrendValue(
      yearSnapshots,
    );

  const previousYear =
    year - 1;
  const nextYear =
    year + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            월별 정리
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            월 마감 snapshot을
            기준으로 연간 흐름과
            월별 변화를 비교합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/monthly-summary?year=${previousYear}`}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"
          >
            ←
          </Link>

          <span className="min-w-20 text-center text-sm font-semibold">
            {year}년
          </span>

          <Link
            href={`/monthly-summary?year=${nextYear}`}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"
          >
            →
          </Link>
        </div>
      </div>

      {yearSnapshots.length ===
      0 ? (
        <Card title={`${year}년 월별 정리`}>
          <div className="mt-4 rounded-xl bg-gray-50 p-6 text-center">
            <p className="text-sm font-semibold text-gray-700">
              이 연도에는 아직
              마감된 월이 없습니다.
            </p>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              월 마감을 완료하면
              이곳에 확정된 월별
              통계가 쌓입니다.
            </p>

            <Link
              href="/monthly-close"
              className="mt-4 inline-flex rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white"
            >
              월 마감으로 이동
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Card
              title="마감 완료 월"
              value={`${yearSummary.closedMonths}개월`}
              sub={`${year}년 중 snapshot이 저장된 월`}
            />

            <Card
              title="누적 확정 수입"
              value={won(
                yearSummary.totalConfirmedIncome,
              )}
              sub={`월 평균 ${won(
                Math.round(
                  yearSummary.totalConfirmedIncome /
                    yearSummary.closedMonths,
                ),
              )}`}
            />

            <Card
              title="누적 생활비 배정"
              value={won(
                yearSummary.totalLivingAllocated,
              )}
              sub={`누적 확정 수입의 ${
                yearSummary.totalConfirmedIncome >
                0
                  ? (
                      (yearSummary.totalLivingAllocated /
                        yearSummary.totalConfirmedIncome) *
                      100
                    ).toFixed(1)
                  : "0.0"
              }%`}
            />

            <Card
              title="누적 생활비 지출"
              value={won(
                yearSummary.totalLivingExpense,
              )}
              sub={`월 평균 ${won(
                yearSummary.averageLivingExpense,
              )}`}
            />

            <Card
              title="누적 투자 지출"
              value={won(
                yearSummary.totalInvestmentExpense,
              )}
              sub={`월 평균 ${won(
                yearSummary.averageInvestmentExpense,
              )}`}
            />

            <Card
              title="연간 고정지출 충당률"
              value={rateText(
                yearSummary.annualFixedCoverageRateBps,
              )}
              sub={`자산소득 ${won(
                yearSummary.totalAssetIncome,
              )} ÷ 고정지출 ${won(
                yearSummary.totalFixedExpense,
              )}`}
            />
          </div>

          <Card
            title={
              latest
                ? `${monthText(
                    latest.snapshot_month,
                  )} 변화`
                : "최근 월 변화"
            }
          >
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs font-medium text-gray-500">
                  생활비 지출
                </p>
                <p className="mt-2 text-lg font-bold">
                  {latest
                    ? won(
                        latest.living_expense_amount,
                      )
                    : "-"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {changeDescription({
                    value:
                      livingExpenseChange,
                    decreaseIsGood:
                      true,
                  })}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs font-medium text-gray-500">
                  투자 지출
                </p>
                <p className="mt-2 text-lg font-bold">
                  {latest
                    ? won(
                        latest.investment_expense_amount,
                      )
                    : "-"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {changeDescription({
                    value:
                      investmentExpenseChange,
                    decreaseIsGood:
                      true,
                  })}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs font-medium text-gray-500">
                  생활비 예산 잔액
                </p>
                <p className="mt-2 text-lg font-bold">
                  {latest
                    ? signedWon(
                        latest.living_budget_balance,
                      )
                    : "-"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {changeDescription({
                    value:
                      budgetBalanceChange,
                  })}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs font-medium text-gray-500">
                  마감 당시 미정산
                </p>
                <p className="mt-2 text-lg font-bold">
                  {latest
                    ? `${latest.unsettled_count}건`
                    : "-"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {countChangeDescription(
                    unsettledChange,
                  )}
                </p>
              </div>
            </div>
          </Card>

          <Card title="월별 흐름">
            <div className="mt-4 space-y-5">
              {yearSnapshots.map(
                (snapshot) => {
                  const month =
                    snapshotMonthNumber(
                      snapshot,
                    );

                  const rows = [
                    {
                      label:
                        "확정 수입",
                      value:
                        snapshot.confirmed_income,
                      className:
                        "bg-emerald-700",
                    },
                    {
                      label:
                        "생활비 배정",
                      value:
                        snapshot.living_allocated_amount,
                      className:
                        "bg-emerald-400",
                    },
                    {
                      label:
                        "생활비 지출",
                      value:
                        snapshot.living_expense_amount,
                      className:
                        "bg-amber-500",
                    },
                    {
                      label:
                        "투자 지출",
                      value:
                        snapshot.investment_expense_amount,
                      className:
                        "bg-gray-500",
                    },
                  ];

                  return (
                    <div
                      key={
                        snapshot.snapshot_month
                      }
                      className="rounded-xl border border-[var(--border)] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <strong className="text-sm">
                          {month}월
                        </strong>
                        <Link
                          href={`/monthly-close?month=${snapshot.snapshot_month.slice(
                            0,
                            7,
                          )}`}
                          className="text-xs font-semibold text-emerald-800"
                        >
                          마감 상세
                        </Link>
                      </div>

                      <div className="space-y-2">
                        {rows.map(
                          (row) => (
                            <div
                              key={
                                row.label
                              }
                              className="grid grid-cols-[72px_1fr_auto] items-center gap-3 text-xs"
                            >
                              <span className="text-gray-500">
                                {
                                  row.label
                                }
                              </span>

                              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                <div
                                  className={`h-full rounded-full ${row.className}`}
                                  style={{
                                    width: `${trendWidthPercent(
                                      row.value,
                                      trendMax,
                                    )}%`,
                                  }}
                                />
                              </div>

                              <span className="min-w-24 text-right font-medium">
                                {won(
                                  row.value,
                                )}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </Card>

          <Card title={`${year}년 월별 상세`}>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[1180px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs text-gray-500">
                    <th className="px-3 py-3">
                      월
                    </th>
                    <th className="px-3 py-3 text-right">
                      확정 수입
                    </th>
                    <th className="px-3 py-3 text-right">
                      생활비 배정
                    </th>
                    <th className="px-3 py-3 text-right">
                      생활비 지출
                    </th>
                    <th className="px-3 py-3 text-right">
                      투자 지출
                    </th>
                    <th className="px-3 py-3 text-right">
                      자산소득
                    </th>
                    <th className="px-3 py-3 text-right">
                      고정지출 충당률
                    </th>
                    <th className="px-3 py-3 text-right">
                      생활비 잔액
                    </th>
                    <th className="px-3 py-3 text-right">
                      월말 장부
                    </th>
                    <th className="px-3 py-3 text-right">
                      월말 실제
                    </th>
                    <th className="px-3 py-3 text-right">
                      미정산
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {yearSnapshots.map(
                    (snapshot) => (
                      <tr
                        key={
                          snapshot.snapshot_month
                        }
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="px-3 py-3 font-semibold">
                          <Link
                            href={`/monthly-close?month=${snapshot.snapshot_month.slice(
                              0,
                              7,
                            )}`}
                            className="hover:text-emerald-800"
                          >
                            {snapshotMonthNumber(
                              snapshot,
                            )}
                            월
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {won(
                            snapshot.confirmed_income,
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {won(
                            snapshot.living_allocated_amount,
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {won(
                            snapshot.living_expense_amount,
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {won(
                            snapshot.investment_expense_amount,
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {won(
                            snapshot.asset_income_amount,
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {rateText(
                            snapshot.fixed_coverage_rate_bps,
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {signedWon(
                            snapshot.living_budget_balance,
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {won(
                            snapshot.living_account_ledger_balance,
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {snapshot.living_account_actual_balance ===
                          null
                            ? "-"
                            : won(
                                snapshot.living_account_actual_balance,
                              )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {
                            snapshot.unsettled_count
                          }
                          건
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="연간 합계">
              <div className="mt-3 divide-y divide-[var(--border)]">
                <MoneyRow
                  label="확정 수입"
                  value={won(
                    yearSummary.totalConfirmedIncome,
                  )}
                />
                <MoneyRow
                  label="생활비 배정"
                  value={won(
                    yearSummary.totalLivingAllocated,
                  )}
                />
                <MoneyRow
                  label="생활비 지출"
                  value={won(
                    yearSummary.totalLivingExpense,
                  )}
                />
                <MoneyRow
                  label="투자 지출"
                  value={won(
                    yearSummary.totalInvestmentExpense,
                  )}
                />
                <MoneyRow
                  label="고정지출"
                  value={won(
                    yearSummary.totalFixedExpense,
                  )}
                />
                <MoneyRow
                  label="자산소득"
                  value={won(
                    yearSummary.totalAssetIncome,
                  )}
                  strong
                />
              </div>
            </Card>

            <Card title="최근 마감 월 상태">
              <div className="mt-3 divide-y divide-[var(--border)]">
                <MoneyRow
                  label="생활비 예산 잔액"
                  value={
                    yearSummary.latestLivingBudgetBalance ===
                    null
                      ? "-"
                      : signedWon(
                          yearSummary.latestLivingBudgetBalance,
                        )
                  }
                />
                <MoneyRow
                  label="생활비 계좌 장부 잔액"
                  value={
                    yearSummary.latestLedgerBalance ===
                    null
                      ? "-"
                      : won(
                          yearSummary.latestLedgerBalance,
                        )
                  }
                />
                <MoneyRow
                  label="생활비 계좌 실제 잔액"
                  value={
                    yearSummary.latestActualBalance ===
                    null
                      ? "미대조"
                      : won(
                          yearSummary.latestActualBalance,
                        )
                  }
                />
                <MoneyRow
                  label="연중 마감 당시 미정산 누계"
                  value={`${yearSummary.totalUnsettledAtClose}건`}
                  strong
                />
              </div>

              <p className="mt-4 text-xs leading-5 text-gray-500">
                미정산 누계는 각 월
                마감 시점의 미정산
                건수를 단순 합산한
                값입니다. 같은 거래가
                여러 월에 중복 집계되는
                값은 아니며, 각 snapshot은
                해당 월 거래만 보존합니다.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

import Link from "next/link";

import {
  Card,
  MoneyRow,
} from "@/components/ui";
import {
  calculateLivingAccountLedgerBalance,
} from "@/domain/reconciliation";
import { requireCurrentHousehold } from "@/lib/household/current";
import { ReconciliationManager } from "@/app/reconciliation/reconciliation-manager";

export const dynamic =
  "force-dynamic";

function getKoreaToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
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
  const day = parts.find(
    (part) =>
      part.type === "day",
  )?.value;

  if (!year || !month || !day) {
    throw new Error(
      "현재 날짜를 확인하지 못했습니다.",
    );
  }

  return `${year}-${month}-${day}`;
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

export default async function ReconciliationPage() {
  const today = getKoreaToday();

  const {
    supabase,
    householdId,
  } =
    await requireCurrentHousehold();

  const {
    data: livingAccount,
    error: livingAccountError,
  } = await supabase
    .from("accounts")
    .select(
      "id, name, is_living_account",
    )
    .eq(
      "household_id",
      householdId,
    )
    .eq(
      "is_living_account",
      true,
    )
    .maybeSingle();

  if (livingAccountError) {
    console.error(
      "Failed to load living account for reconciliation:",
      livingAccountError,
    );

    throw new Error(
      "생활비 계좌 정보를 불러오지 못했습니다.",
    );
  }

  if (!livingAccount) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold">
            생활비 계좌 잔액 대조
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            은행 앱의 실제 잔액과
            프로그램 장부 잔액을
            비교합니다.
          </p>
        </div>

        <Card title="생활비 계좌 설정 필요">
          <div className="mt-3 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            잔액 대조를 시작하려면
            먼저 생활비 계좌를 하나
            지정해주세요.
          </div>

          <Link
            href="/settings/accounts"
            className="mt-4 inline-flex rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white"
          >
            카드/계좌 설정으로 이동
          </Link>
        </Card>
      </div>
    );
  }

  const [
    historyResult,
    transactionsResult,
  ] = await Promise.all([
    supabase
      .from(
        "account_reconciliations",
      )
      .select(
        "id, checked_date, actual_balance, ledger_balance, difference_amount, memo, created_at",
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
      ),
  ]);

  if (historyResult.error) {
    console.error(
      "Failed to load reconciliation history:",
      historyResult.error,
    );

    throw new Error(
      "잔액 대조 이력을 불러오지 못했습니다.",
    );
  }

  if (transactionsResult.error) {
    console.error(
      "Failed to load reconciliation transactions:",
      transactionsResult.error,
    );

    throw new Error(
      "장부 잔액 계산에 필요한 거래를 불러오지 못했습니다.",
    );
  }

  const history =
    historyResult.data ?? [];
  const transactions =
    transactionsResult.data ?? [];
  const latest =
    history[0] ?? null;

  const expectedToday =
    latest &&
    latest.checked_date <=
      today
      ? calculateLivingAccountLedgerBalance(
          {
            baselineActualBalance:
              latest.actual_balance,
            baselineDate:
              latest.checked_date,
            targetDate: today,
            livingAccountId:
              livingAccount.id,
            transactions,
          },
        )
      : null;

  const latestDifference =
    latest
      ? latest
          .difference_amount ??
        latest.actual_balance -
          latest.ledger_balance
      : null;

  const visibleHistory =
    history.slice(0, 12);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">
          생활비 계좌 잔액 대조
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {livingAccount.name}의
          은행 실제 잔액과 거래·정산
          기록으로 계산한 장부 잔액을
          비교합니다.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          title="오늘 예상 장부 잔액"
          value={
            expectedToday === null
              ? "기준 잔액 필요"
              : won(
                  expectedToday,
                )
          }
          sub={
            latest
              ? `${latest.checked_date} 실제 잔액을 기준으로 ${today}까지 계산`
              : "첫 잔액 대조를 저장하면 이후부터 자동 계산합니다."
          }
        />

        <Card
          title="최근 실제 잔액"
          value={
            latest
              ? won(
                  latest.actual_balance,
                )
              : "-"
          }
          sub={
            latest
              ? `최근 대조일 ${latest.checked_date}`
              : "아직 대조 기록이 없습니다."
          }
        />

        <Card
          title="최근 대조 차이"
          value={
            latestDifference ===
            null
              ? "-"
              : signedWon(
                  latestDifference,
                )
          }
          sub={
            latestDifference ===
            null
              ? "실제 잔액 - 프로그램 장부 잔액"
              : latestDifference ===
                  0
                ? "최근 대조에서 잔액이 일치했습니다."
                : "양수는 실제 잔액이 더 많고, 음수는 실제 잔액이 더 적다는 뜻입니다."
          }
        />
      </div>

      <Card title="실제 잔액 입력">
        <ReconciliationManager
          defaultDate={today}
          latestDate={
            latest?.checked_date ??
            null
          }
          hasBaseline={
            latest !== null
          }
        />
      </Card>

      <Card title="대조 이력">
        {visibleHistory.length ===
        0 ? (
          <div className="mt-4 rounded-xl bg-gray-50 p-5 text-center text-sm text-gray-500">
            아직 저장된 잔액 대조가
            없습니다.
          </div>
        ) : (
          <div className="mt-3 divide-y divide-[var(--border)]">
            {visibleHistory.map(
              (
                item,
                index,
              ) => {
                const difference =
                  item
                    .difference_amount ??
                  item.actual_balance -
                    item.ledger_balance;

                const isFirstBaseline =
                  history.length <=
                    12 &&
                  index ===
                    visibleHistory.length -
                      1;

                return (
                  <div
                    key={
                      item.id
                    }
                    className="py-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">
                            {
                              item.checked_date
                            }
                          </p>

                          {isFirstBaseline ? (
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                              첫 기준
                            </span>
                          ) : difference ===
                            0 ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              일치
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              차이{" "}
                              {signedWon(
                                difference,
                              )}
                            </span>
                          )}
                        </div>

                        {item.memo ? (
                          <p className="mt-1 text-xs text-gray-500">
                            {
                              item.memo
                            }
                          </p>
                        ) : null}
                      </div>

                      <div className="text-sm sm:text-right">
                        <p>
                          실제{" "}
                          <strong>
                            {won(
                              item.actual_balance,
                            )}
                          </strong>
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          장부{" "}
                          {won(
                            item.ledger_balance,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}

        {history.length > 12 ? (
          <p className="mt-3 text-center text-xs text-gray-500">
            최근 12건만 표시합니다.
          </p>
        ) : null}
      </Card>

      <Card title="장부 잔액 계산 기준">
        <div className="mt-3 divide-y divide-[var(--border)]">
          <MoneyRow
            label="직접 입금"
            value="생활비 계좌 수입 +"
          />
          <MoneyRow
            label="직접 출금"
            value="생활비 계좌 지출 -"
          />
          <MoneyRow
            label="받은 정산"
            value="정산 완료액 +"
          />
          <MoneyRow
            label="보낸 정산"
            value="정산 완료액 -"
          />
        </div>

        <p className="mt-4 text-xs leading-5 text-gray-500">
          대조는 하루 마감 기준으로
          관리합니다. 저장된 실제 잔액은
          다음 대조의 새 기준점이 되므로,
          이전 대조의 차이가 다음 날짜까지
          계속 누적되지는 않습니다.
        </p>
      </Card>
    </div>
  );
}

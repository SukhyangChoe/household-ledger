import Link from "next/link";

import { Card } from "@/components/ui";
import {
  buildSetupProgress,
  type SetupStepId,
} from "@/domain/setup";
import { requireCurrentHousehold } from "@/lib/household/current";

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

const stepCopy: Record<
  SetupStepId,
  {
    number: string;
    title: string;
    description: string;
    completeDescription: string;
  }
> = {
  accounts: {
    number: "1",
    title: "계좌와 생활비 계좌",
    description:
      "실제로 돈이 들어오고 나가는 계좌를 등록하고, 그중 하나를 생활비 계좌로 지정합니다.",
    completeDescription:
      "활성 계좌와 생활비 계좌가 준비되었습니다.",
  },
  rates: {
    number: "2",
    title: "생활비 반영률",
    description:
      "수입이 들어왔을 때 얼마를 생활비로 배정할지 현재 사용할 반영률을 등록합니다.",
    completeDescription:
      "현재 날짜에 적용할 수 있는 생활비 반영률이 있습니다.",
  },
  categories: {
    number: "3",
    title: "수입 · 지출 카테고리",
    description:
      "월급, 이자, 식비, 관리비처럼 실제 거래 입력에 사용할 수입·지출 분류를 준비합니다.",
    completeDescription:
      "활성 수입 카테고리와 지출 카테고리가 모두 준비되었습니다.",
  },
};

export default async function SettingsPage() {
  const {
    supabase,
    householdId,
  } =
    await requireCurrentHousehold();

  const [
    accountsResult,
    rateRulesResult,
    categoriesResult,
    cardsResult,
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select(
        "is_active, is_living_account",
      )
      .eq(
        "household_id",
        householdId,
      ),

    supabase
      .from("rate_rules")
      .select(
        "is_active, valid_from, valid_to",
      )
      .eq(
        "household_id",
        householdId,
      ),

    supabase
      .from("categories")
      .select(
        "is_active, transaction_type",
      )
      .eq(
        "household_id",
        householdId,
      ),

    supabase
      .from("cards")
      .select("is_active")
      .eq(
        "household_id",
        householdId,
      ),
  ]);

  const firstError =
    accountsResult.error ??
    rateRulesResult.error ??
    categoriesResult.error ??
    cardsResult.error;

  if (firstError) {
    console.error(
      "Failed to load setup progress:",
      firstError,
    );

    throw new Error(
      "설정 준비 상태를 확인하지 못했습니다.",
    );
  }

  const progress =
    buildSetupProgress({
      accounts:
        accountsResult.data ?? [],
      rateRules:
        rateRulesResult.data ?? [],
      categories:
        categoriesResult.data ?? [],
      cards:
        cardsResult.data ?? [],
      today: getKoreaToday(),
    });

  const completionPercent =
    Math.round(
      (progress.completedRequiredSteps /
        progress.totalRequiredSteps) *
        100,
    );

  const nextCopy =
    progress.nextRequiredStep
      ? stepCopy[
          progress.nextRequiredStep
            .id
        ]
      : null;

  return (
    <div className="space-y-5">
      <Card title="가계부 사용 준비">
        <div className="mt-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold tracking-tight">
                {
                  progress.completedRequiredSteps
                }
                /{
                  progress.totalRequiredSteps
                }
              </p>
              <p className="mt-1 text-sm text-gray-500">
                필수 설정 완료
              </p>
            </div>

            <span
              className={
                progress.ready
                  ? "rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800"
                  : "rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800"
              }
            >
              {progress.ready
                ? "기본 준비 완료"
                : `${completionPercent}% 준비됨`}
            </span>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-emerald-700 transition-all"
              style={{
                width: `${completionPercent}%`,
              }}
            />
          </div>

          <p className="mt-4 text-sm leading-6 text-gray-600">
            거래를 제대로 기록하고
            생활비 정산을 계산하려면
            아래 세 가지 기본 설정이
            필요합니다. 순서대로 해도
            되고, 이미 준비된 항목은
            자동으로 완료 표시됩니다.
          </p>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {progress.steps.map(
          (step) => {
            const copy =
              stepCopy[step.id];

            let detail = "";

            if (
              step.id ===
              "accounts"
            ) {
              detail = `활성 계좌 ${progress.activeAccountCount}개 · 생활비 계좌 ${
                progress.hasLivingAccount
                  ? "지정됨"
                  : "미지정"
              }`;
            } else if (
              step.id === "rates"
            ) {
              detail = `현재 적용 가능 반영률 ${progress.currentRateRuleCount}개`;
            } else {
              detail = `수입 ${progress.activeIncomeCategoryCount}개 · 지출 ${progress.activeExpenseCategoryCount}개`;
            }

            return (
              <Link
                key={step.id}
                href={step.href}
                className={[
                  "rounded-2xl border bg-white p-5 transition",
                  step.complete
                    ? "border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/40"
                    : "border-amber-200 hover:border-amber-300 hover:bg-amber-50/40",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">
                    {
                      copy.number
                    }
                  </div>

                  <span
                    className={
                      step.complete
                        ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800"
                        : "rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800"
                    }
                  >
                    {step.complete
                      ? "완료"
                      : "설정 필요"}
                  </span>
                </div>

                <p className="mt-4 font-bold">
                  {copy.title}
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {step.complete
                    ? copy.completeDescription
                    : copy.description}
                </p>

                <p className="mt-3 text-xs font-medium text-gray-500">
                  {detail}
                </p>

                <p className="mt-4 text-sm font-semibold text-emerald-800">
                  {step.complete
                    ? "설정 확인하기 →"
                    : "설정하러 가기 →"}
                </p>
              </Link>
            );
          },
        )}
      </div>

      {progress.ready ? (
        <Card title="기본 설정 완료">
          <div className="mt-3 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
            이제 수입·지출 거래를
            등록하고 생활비 정산을
            사용할 기본 준비가
            끝났습니다.
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/ledger"
              className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white"
            >
              월별 가계부 시작
            </Link>

            <Link
              href="/recurring"
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold"
            >
              정기 항목 등록
            </Link>
          </div>
        </Card>
      ) : (
        <Card title="다음으로 할 일">
          <p className="mt-3 text-sm leading-6 text-gray-600">
            다음 필수 단계는{" "}
            <strong>
              {nextCopy?.title}
            </strong>
            입니다.
          </p>

          {progress.nextRequiredStep ? (
            <Link
              href={
                progress.nextRequiredStep
                  .href
              }
              className="mt-4 inline-flex rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white"
            >
              {nextCopy?.title} 설정
              시작
            </Link>
          ) : null}
        </Card>
      )}

      <Card title="선택 설정 · 카드">
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm leading-6 text-gray-600">
              신용카드나 체크카드
              결제를 가계부에서
              관리한다면 카드와 실제
              대금 출금 계좌·결제일을
              등록하세요. 카드를 쓰지
              않는다면 건너뛰어도
              됩니다.
            </p>
            <p className="mt-2 text-xs font-medium text-gray-500">
              현재 활성 카드{" "}
              {
                progress.activeCardCount
              }
              개
            </p>
          </div>

          <Link
            href="/settings/accounts"
            className="shrink-0 rounded-xl border border-[var(--border)] px-4 py-2.5 text-center text-sm font-semibold"
          >
            카드 · 계좌 관리
          </Link>
        </div>
      </Card>
    </div>
  );
}

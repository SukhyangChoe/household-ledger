"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  createRecurringRule,
  deleteRecurringRule,
  toggleRecurringRuleActive,
  updateRecurringRule,
  type RecurringActionState,
} from "@/app/recurring/actions";
import { Badge } from "@/components/ui";
import { occurrenceProgress } from "@/domain/recurring";
import type { Database } from "@/types/database.types";

type Rule =
  Database["public"]["Tables"]["recurring_rules"]["Row"];
type Account =
  Database["public"]["Tables"]["accounts"]["Row"];
type Card =
  Database["public"]["Tables"]["cards"]["Row"];
type Category =
  Database["public"]["Tables"]["categories"]["Row"];
type RateRule =
  Database["public"]["Tables"]["rate_rules"]["Row"];

type RecurringTransactionType =
  | "income"
  | "expense";
type PaymentMethod =
  | "account"
  | "card";
type RecurrenceFrequency =
  | "monthly"
  | "yearly";
type RecurringPageMode =
  | "general"
  | "card";
type RecurringGroupBy =
  | "default"
  | "card"
  | "category"
  | "expenseNature";

type Props = {
  mode: RecurringPageMode;
  rules: Rule[];
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  rateRules: RateRule[];
  currentMonth: string;
};

type FormFieldsProps = {
  mode: RecurringPageMode;
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  rateRules: RateRule[];
  currentMonth: string;
  initialRule?: Rule;
};

const initialState: RecurringActionState = {
  status: "idle",
  message: "",
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const ownerLabels: Record<
  Rule["owner_type"],
  string
> = {
  wife: "아내",
  husband: "남편",
  joint: "공동",
};

const fundPurposeLabels = {
  living: "생활비",
  investment: "투자",
} as const;

const expenseNatureLabels = {
  fixed: "고정",
  variable: "변동",
  irregular: "비정기",
} as const;

function won(amount: number) {
  return new Intl.NumberFormat(
    "ko-KR",
    {
      style: "currency",
      currency: "KRW",
      maximumFractionDigits: 0,
    },
  ).format(amount);
}

function monthText(
  value: string | null,
) {
  if (!value) {
    return "계속";
  }

  return value.slice(0, 7);
}

function frequencyText(rule: Rule) {
  if (
    rule.recurrence_frequency ===
    "yearly"
  ) {
    return `매년 ${rule.recurrence_month ?? "?"}월`;
  }

  return "매월";
}

function ActionMessage({
  state,
}: {
  state: RecurringActionState;
}) {
  if (state.status === "idle") {
    return null;
  }

  return (
    <p
      className={
        state.status === "success"
          ? "mt-3 text-sm text-emerald-700"
          : "mt-3 text-sm text-red-600"
      }
    >
      {state.message}
    </p>
  );
}

function FormFields({
  mode,
  accounts,
  cards,
  categories,
  rateRules,
  currentMonth,
  initialRule,
}: FormFieldsProps) {
  const initialTransactionType:
    RecurringTransactionType =
      mode === "card"
        ? "expense"
        : initialRule?.transaction_type ===
            "income"
          ? "income"
          : "expense";

  const initialPaymentMethod:
    PaymentMethod =
      mode === "card"
        ? "card"
        : "account";

  const initialStartMonth =
    initialRule?.start_month.slice(
      0,
      7,
    ) ?? currentMonth;

  const initialRecurrenceFrequency:
    RecurrenceFrequency =
      initialRule?.recurrence_frequency ===
      "yearly"
        ? "yearly"
        : "monthly";

  const [
    transactionType,
    setTransactionType,
  ] = useState<
    RecurringTransactionType
  >(initialTransactionType);

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<PaymentMethod>(
    initialTransactionType === "income"
      ? "account"
      : initialPaymentMethod,
  );

  const [
    recurrenceFrequency,
    setRecurrenceFrequency,
  ] = useState<RecurrenceFrequency>(
    initialRecurrenceFrequency,
  );

  const [
    startMonth,
    setStartMonth,
  ] = useState(initialStartMonth);

  const [
    recurrenceMonth,
    setRecurrenceMonth,
  ] = useState(
    initialRule?.recurrence_month ??
      Number(
        initialStartMonth.slice(5, 7),
      ),
  );

  const [
    categoryId,
    setCategoryId,
  ] = useState(
    initialRule?.category_id ??
      categories.find(
        (category) =>
          category.is_active &&
          category.transaction_type ===
            initialTransactionType,
      )?.id ??
      "",
  );

  const visibleCategories =
    categories.filter(
      (category) =>
        category.transaction_type ===
          transactionType &&
        (
          category.is_active ||
          category.id === categoryId
        ),
    );

  const visibleAccounts =
    accounts.filter(
      (account) =>
        account.is_active ||
        account.id ===
          initialRule?.account_id,
    );

  const visibleCards =
    cards.filter(
      (card) =>
        card.is_active ||
        card.id ===
          initialRule?.card_id,
    );

  const visibleRateRules =
    rateRules.filter(
      (rateRule) =>
        rateRule.is_active ||
        rateRule.id ===
          initialRule?.rate_rule_id,
    );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {mode === "card" ? (
          <>
            <input
              type="hidden"
              name="transactionType"
              value="expense"
            />
            <div className="text-sm font-medium">
              유형
              <div className="mt-2 rounded-xl border border-[var(--border)] bg-gray-50 px-3 py-2.5 text-sm font-normal text-gray-600">
                카드 지출
              </div>
            </div>
          </>
        ) : (
          <label className="text-sm font-medium">
            유형
            <select
              name="transactionType"
              value={transactionType}
              onChange={(event) => {
                const value =
                  event.currentTarget.value;

                if (
                  value !== "income" &&
                  value !== "expense"
                ) {
                  return;
                }

                setTransactionType(value);
                setPaymentMethod(
                  "account",
                );

                setCategoryId(
                  categories.find(
                    (category) =>
                      category.is_active &&
                      category
                        .transaction_type ===
                        value,
                  )?.id ?? "",
                );
              }}
              className={inputClassName}
            >
              <option value="expense">
                지출
              </option>
              <option value="income">
                수입
              </option>
            </select>
          </label>
        )}

        <label className="text-sm font-medium">
          항목명
          <input
            name="name"
            type="text"
            defaultValue={
              initialRule?.name ?? ""
            }
            maxLength={80}
            placeholder="예: 월세, 보험료, 급여"
            required
            className={inputClassName}
          />
        </label>

        <label className="text-sm font-medium">
          금액
          <input
            name="amount"
            type="number"
            min={1}
            step={1}
            defaultValue={
              initialRule?.amount ?? ""
            }
            required
            className={inputClassName}
          />
        </label>

        <label className="text-sm font-medium">
          소유자
          <select
            name="ownerType"
            defaultValue={
              initialRule?.owner_type ??
              "joint"
            }
            className={inputClassName}
          >
            <option value="wife">
              아내
            </option>
            <option value="husband">
              남편
            </option>
            <option value="joint">
              공동
            </option>
          </select>
        </label>

        <div className="sm:col-span-2 rounded-xl border border-[var(--border)] bg-gray-50 p-4">
          <div
            className={`grid gap-4 ${
              recurrenceFrequency ===
              "yearly"
                ? "sm:grid-cols-3"
                : "sm:grid-cols-2"
            }`}
          >
            <label className="text-sm font-medium">
              반복 주기
              <select
                name="recurrenceFrequency"
                value={recurrenceFrequency}
                onChange={(event) => {
                  const value =
                    event.currentTarget.value;

                  if (
                    value !== "monthly" &&
                    value !== "yearly"
                  ) {
                    return;
                  }

                  setRecurrenceFrequency(
                    value,
                  );

                  if (value === "yearly") {
                    setRecurrenceMonth(
                      Number(
                        startMonth.slice(5, 7),
                      ),
                    );
                  }
                }}
                className={inputClassName}
              >
                <option value="monthly">
                  매월
                </option>
                <option value="yearly">
                  매년
                </option>
              </select>
            </label>

            {recurrenceFrequency ===
            "yearly" ? (
              <label className="text-sm font-medium">
                매년 반영 월
                <select
                  name="recurrenceMonth"
                  value={recurrenceMonth}
                  onChange={(event) => {
                    setRecurrenceMonth(
                      Number(
                        event.currentTarget
                          .value,
                      ),
                    );
                  }}
                  required
                  className={inputClassName}
                >
                  {Array.from(
                    { length: 12 },
                    (_, index) =>
                      index + 1,
                  ).map((month) => (
                    <option
                      key={month}
                      value={month}
                    >
                      {month}월
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {paymentMethod ===
            "account" ? (
              <label className="text-sm font-medium">
                {recurrenceFrequency ===
                "yearly"
                  ? "매년 반영일"
                  : "매월 반영일"}
                <input
                  name="paymentDay"
                  type="number"
                  min={1}
                  max={31}
                  step={1}
                  defaultValue={
                    initialRule
                      ?.payment_day ?? 1
                  }
                  required
                  className={inputClassName}
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  없는 날짜는 해당 월의 마지막 날로 반영됩니다.
                </span>
              </label>
            ) : recurrenceFrequency ===
              "yearly" ? (
              <div className="text-sm font-medium">
                매년 반영일
                <div className="mt-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm font-normal text-gray-500">
                  선택한 카드의 결제일 사용
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <label className="text-sm font-medium">
          시작 월
          <input
            name="startMonth"
            type="month"
            value={startMonth}
            onChange={(event) => {
              setStartMonth(
                event.currentTarget.value,
              );
            }}
            required
            className={inputClassName}
          />
        </label>

        <label className="text-sm font-medium">
          종료 월
          <input
            name="endMonth"
            type="month"
            defaultValue={
              initialRule?.end_month?.slice(
                0,
                7,
              ) ?? ""
            }
            className={inputClassName}
          />
          <span className="mt-1 block text-xs font-normal text-gray-500">
            종료 시점이 없으면 비워두세요.
          </span>
        </label>

        <label className="text-sm font-medium">
          카테고리
          <select
            name="categoryId"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(
                event.currentTarget.value,
              );
            }}
            required
            className={inputClassName}
          >
            <option value="">
              선택
            </option>

            {visibleCategories.map(
              (category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                  {category.is_active
                    ? ""
                    : " · 비활성"}
                </option>
              ),
            )}
          </select>
        </label>

        <>
          <input
            type="hidden"
            name="paymentMethod"
            value={
              mode === "card"
                ? "card"
                : "account"
            }
          />
          <div className="text-sm font-medium">
            결제 방식
            <div className="mt-2 rounded-xl border border-[var(--border)] bg-gray-50 px-3 py-2.5 text-sm font-normal text-gray-600">
              {mode === "card"
                ? "카드 결제"
                : transactionType ===
                    "income"
                  ? "계좌 입금"
                  : "계좌 직접 결제"}
            </div>
          </div>
        </>

        {paymentMethod ===
        "account" ? (
          <label className="text-sm font-medium sm:col-span-2">
            {transactionType ===
            "income"
              ? "입금 계좌"
              : "출금 계좌"}
            <select
              name="accountId"
              defaultValue={
                initialRule?.account_id ??
                ""
              }
              required
              className={inputClassName}
            >
              <option value="">
                선택
              </option>

              {visibleAccounts.map(
                (account) => (
                  <option
                    key={account.id}
                    value={account.id}
                  >
                    {account.name}
                    {account.is_active
                      ? ""
                      : " · 비활성"}
                  </option>
                ),
              )}
            </select>
          </label>
        ) : (
          <label className="text-sm font-medium sm:col-span-2">
            결제 카드
            <select
              name="cardId"
              defaultValue={
                initialRule?.card_id ?? ""
              }
              required
              className={inputClassName}
            >
              <option value="">
                선택
              </option>

              {visibleCards.map(
                (card) => (
                  <option
                    key={card.id}
                    value={card.id}
                  >
                    {card.name} · 결제일{" "}
                    {card.payment_day}일
                    {card.is_active
                      ? ""
                      : " · 비활성"}
                  </option>
                ),
              )}
            </select>

            <span className="mt-1 block text-xs font-normal text-gray-500">
              {recurrenceFrequency ===
              "yearly"
                ? "선택한 연간 반영 월에 카드 설정의 결제일과 결제 계좌가 적용됩니다."
                : "카드 설정의 결제일과 결제 계좌가 자동 적용됩니다."}
            </span>
          </label>
        )}

        {transactionType ===
        "income" ? (
          <label className="text-sm font-medium sm:col-span-2">
            생활비 반영률
            <select
              name="rateRuleId"
              defaultValue={
                initialRule?.rate_rule_id ??
                ""
              }
              className={inputClassName}
            >
              <option value="">
                카테고리 기본값 사용
              </option>

              {visibleRateRules.map(
                (rateRule) => (
                  <option
                    key={rateRule.id}
                    value={rateRule.id}
                  >
                    {rateRule.name} ·{" "}
                    {(
                      rateRule.rate_bps /
                      100
                    ).toFixed(2)}
                    % ·{" "}
                    {rateRule.valid_from}
                    {rateRule.is_active
                      ? ""
                      : " · 비활성"}
                  </option>
                ),
              )}
            </select>
          </label>
        ) : (
          <>
            <label className="text-sm font-medium">
              지출 목적
              <select
                name="fundPurpose"
                defaultValue={
                  initialRule
                    ?.fund_purpose ??
                  "living"
                }
                className={inputClassName}
              >
                <option value="living">
                  생활비
                </option>
                <option value="investment">
                  투자
                </option>
              </select>
            </label>

            <label className="text-sm font-medium">
              지출 성격
              <select
                name="expenseNature"
                defaultValue={
                  initialRule
                    ?.expense_nature ??
                  "fixed"
                }
                className={inputClassName}
              >
                <option value="fixed">
                  고정
                </option>
                <option value="variable">
                  변동
                </option>
                <option value="irregular">
                  비정기
                </option>
              </select>
            </label>
          </>
        )}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          name="showOccurrenceProgress"
          type="checkbox"
          defaultChecked={
            initialRule
              ?.show_occurrence_progress ??
            false
          }
          className="h-4 w-4 accent-emerald-700"
        />
        종료 월이 있는 경우 회차 표시
      </label>

      <label className="mt-4 block text-sm font-medium">
        메모
        <input
          name="memo"
          type="text"
          maxLength={300}
          defaultValue={
            initialRule?.memo ?? ""
          }
          placeholder="선택 입력"
          className={inputClassName}
        />
      </label>
    </>
  );
}

function CreateRuleForm({
  mode,
  accounts,
  cards,
  categories,
  rateRules,
  currentMonth,
}: Omit<Props, "rules">) {
  const router = useRouter();
  const detailsRef =
    useRef<HTMLDetailsElement>(null);
  const formRef =
    useRef<HTMLFormElement>(null);

  const [
    resetVersion,
    setResetVersion,
  ] = useState(0);

  const [
    state,
    formAction,
    isPending,
  ] = useActionState(
    createRecurringRule,
    initialState,
  );

  useEffect(() => {
    if (
      state.status === "success"
    ) {
      formRef.current?.reset();
      detailsRef.current?.removeAttribute(
        "open",
      );
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <details
        ref={detailsRef}
        className="mt-4 rounded-2xl border border-[var(--border)] bg-gray-50"
      >
        <summary className="cursor-pointer px-4 py-4 font-semibold">
          {mode === "card"
            ? "새 카드 정기 결제 등록"
            : "새 일반 정기 결제 등록"}
        </summary>

        <form
          ref={formRef}
          action={formAction}
          onReset={() => {
            setResetVersion(
              (value) => value + 1,
            );
          }}
          className="border-t border-[var(--border)] p-4"
        >
          <FormFields
            key={resetVersion}
            mode={mode}
            accounts={accounts}
            cards={cards}
            categories={categories}
            rateRules={rateRules}
            currentMonth={currentMonth}
          />

          <button
            type="submit"
            disabled={isPending}
            className="mt-4 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "등록 중..."
              : mode === "card"
                ? "카드 정기 결제 등록"
                : "일반 정기 결제 등록"}
          </button>
        </form>
      </details>

      <ActionMessage
        state={state}
      />
    </>
  );
}

function RuleRow({
  mode,
  rule,
  accounts,
  cards,
  categories,
  rateRules,
  currentMonth,
}: {
  mode: RecurringPageMode;
  rule: Rule;
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  rateRules: RateRule[];
  currentMonth: string;
}) {
  const router = useRouter();
  const editDetailsRef =
    useRef<HTMLDetailsElement>(null);

  const [
    updateState,
    updateAction,
    updatePending,
  ] = useActionState(
    updateRecurringRule,
    initialState,
  );

  const [
    activeState,
    activeAction,
    activePending,
  ] = useActionState(
    toggleRecurringRuleActive,
    initialState,
  );

  const [
    deleteState,
    deleteAction,
    deletePending,
  ] = useActionState(
    deleteRecurringRule,
    initialState,
  );

  useEffect(() => {
    if (
      updateState.status === "success"
    ) {
      editDetailsRef.current?.removeAttribute(
        "open",
      );
      router.refresh();
    }
  }, [updateState, router]);

  useEffect(() => {
    if (
      activeState.status === "success" ||
      deleteState.status === "success"
    ) {
      router.refresh();
    }
  }, [activeState, deleteState, router]);

  const account = accounts.find(
    (item) =>
      item.id === rule.account_id,
  );
  const card = cards.find(
    (item) =>
      item.id === rule.card_id,
  );
  const category =
    categories.find(
      (item) =>
        item.id === rule.category_id,
    );

  const progress =
    rule.show_occurrence_progress
      ? occurrenceProgress(
          currentMonth,
          rule.start_month.slice(
            0,
            7,
          ),
          rule.end_month?.slice(
            0,
            7,
          ) ?? null,
          rule.recurrence_frequency,
          rule.recurrence_month,
        )
      : null;

  const progressText =
    !rule.show_occurrence_progress
      ? "일반"
      : !progress
        ? "기간 외"
        : progress.total === null
          ? `${progress.current}회차`
          : `${progress.current}/${progress.total}회차`;

  const recurrenceLabel =
    frequencyText(rule);

  const connectionText = card
    ? `${card.name} · ${recurrenceLabel} ${card.payment_day}일`
    : account
      ? `${account.name} · ${recurrenceLabel} ${rule.payment_day}일`
      : "연결 확인 필요";

  return (
    <div className="py-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`font-semibold ${
                rule.is_active
                  ? ""
                  : "text-gray-400 line-through"
              }`}
            >
              {rule.name}
            </p>

            <Badge
              tone={
                rule.transaction_type ===
                "income"
                  ? "good"
                  : "warn"
              }
            >
              {rule.transaction_type ===
              "income"
                ? "수입"
                : "지출"}
            </Badge>

            <Badge>
              {recurrenceLabel}
            </Badge>

            <Badge>
              {progressText}
            </Badge>

            {!rule.is_active ? (
              <Badge tone="warn">
                비활성
              </Badge>
            ) : null}
          </div>

          <p className="mt-2 text-sm text-gray-600">
            {rule.start_month.slice(
              0,
              7,
            )}{" "}
            ~ {monthText(rule.end_month)}
            {" · "}
            {won(rule.amount)}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {category?.name ??
              "카테고리 확인 필요"}
            {" · "}
            {connectionText}
            {" · "}
            {ownerLabels[
              rule.owner_type
            ]}
            {rule.transaction_type ===
              "expense" &&
            rule.fund_purpose &&
            rule.expense_nature
              ? ` · ${
                  fundPurposeLabels[
                    rule.fund_purpose
                  ]
                } · ${
                  expenseNatureLabels[
                    rule.expense_nature
                  ]
                }`
              : ""}
          </p>

          {rule.memo ? (
            <p className="mt-1 text-xs text-gray-400">
              {rule.memo}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <form
            action={activeAction}
          >
            <input
              type="hidden"
              name="recurringRuleId"
              value={rule.id}
            />
            <input
              type="hidden"
              name="nextActive"
              value={String(
                !rule.is_active,
              )}
            />

            <button
              type="submit"
              disabled={activePending}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:opacity-60"
            >
              {activePending
                ? "처리 중..."
                : rule.is_active
                  ? "비활성화"
                  : "활성화"}
            </button>
          </form>

          <form
            action={deleteAction}
            onSubmit={(event) => {
              const confirmed =
                window.confirm(
                  `"${rule.name}" 정기 항목을 완전히 삭제할까요?\n\n이미 거래를 생성한 항목은 삭제되지 않습니다.`,
                );

              if (!confirmed) {
                event.preventDefault();
              }
            }}
          >
            <input
              type="hidden"
              name="recurringRuleId"
              value={rule.id}
            />

            <button
              type="submit"
              disabled={deletePending}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
            >
              {deletePending
                ? "삭제 중..."
                : "삭제"}
            </button>
          </form>
        </div>
      </div>

      <ActionMessage
        state={activeState}
      />
      <ActionMessage
        state={deleteState}
      />

      <details
        ref={editDetailsRef}
        className="mt-4"
      >
        <summary className="cursor-pointer text-sm font-semibold text-gray-600">
          {mode === "card"
            ? "카드 정기 결제 수정"
            : "일반 정기 결제 수정"}
        </summary>

        <form
          action={updateAction}
          className="mt-3 rounded-xl bg-gray-50 p-4"
        >
          <input
            type="hidden"
            name="recurringRuleId"
            value={rule.id}
          />

          <FormFields
            key={rule.updated_at}
            mode={mode}
            accounts={accounts}
            cards={cards}
            categories={categories}
            rateRules={rateRules}
            currentMonth={currentMonth}
            initialRule={rule}
          />

          <button
            type="submit"
            disabled={updatePending}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {updatePending
              ? "저장 중..."
              : "수정 저장"}
          </button>
        </form>
      </details>

      <ActionMessage
        state={updateState}
      />
    </div>
  );
}

const expenseNatureGroupLabels = {
  fixed: "고정",
  variable: "변동",
  irregular: "비정기",
  income: "수입",
  unknown: "지출 성격 확인 필요",
} as const;

type RuleGroup = {
  key: string;
  title: string;
  rules: Rule[];
};

function groupRulesByCategory(
  rules: Rule[],
  categories: Category[],
): RuleGroup[] {
  const grouped = new Map<string, RuleGroup>();

  for (const rule of rules) {
    const category = categories.find(
      (item) => item.id === rule.category_id,
    );
    const key = category?.id ?? "missing-category";
    const title =
      category?.name ?? "카테고리 확인 필요";
    const existing = grouped.get(key);

    if (existing) {
      existing.rules.push(rule);
    } else {
      grouped.set(key, {
        key,
        title,
        rules: [rule],
      });
    }
  }

  return Array.from(grouped.values());
}

function groupRulesByExpenseNature(
  rules: Rule[],
): RuleGroup[] {
  const order = [
    "income",
    "fixed",
    "variable",
    "irregular",
    "unknown",
  ] as const;

  const grouped = new Map<
    (typeof order)[number],
    Rule[]
  >();

  for (const rule of rules) {
    const key =
      rule.transaction_type === "income"
        ? "income"
        : rule.expense_nature === "fixed" ||
            rule.expense_nature === "variable" ||
            rule.expense_nature === "irregular"
          ? rule.expense_nature
          : "unknown";

    const existing = grouped.get(key);
    if (existing) {
      existing.push(rule);
    } else {
      grouped.set(key, [rule]);
    }
  }

  return order
    .filter((key) => grouped.has(key))
    .map((key) => ({
      key,
      title: expenseNatureGroupLabels[key],
      rules: grouped.get(key) ?? [],
    }));
}

function RuleGroupSection({
  title,
  rules,
  mode,
  accounts,
  cards,
  categories,
  rateRules,
  currentMonth,
}: {
  title: string;
  rules: Rule[];
  mode: RecurringPageMode;
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  rateRules: RateRule[];
  currentMonth: string;
}) {
  const activeRules = rules.filter(
    (rule) => rule.is_active,
  );
  const activeMonthlyAmount = activeRules
    .filter(
      (rule) =>
        rule.recurrence_frequency === "monthly",
    )
    .reduce(
      (sum, rule) => sum + rule.amount,
      0,
    );
  const activeYearlyCount = activeRules.filter(
    (rule) =>
      rule.recurrence_frequency === "yearly",
  ).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] bg-slate-50/80 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-gray-900">
                {title}
              </h3>
              <Badge>
                등록 {rules.length}건
              </Badge>
              <Badge>
                활성 {activeRules.length}건
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 sm:justify-end">
            <span>
              매월 반복 {won(activeMonthlyAmount)}
            </span>
            {activeYearlyCount > 0 ? (
              <span>
                연간 반복 {activeYearlyCount}건
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="divide-y divide-[var(--border)] px-4 sm:px-5">
        {rules.map((rule) => (
          <RuleRow
            key={rule.id}
            mode={mode}
            rule={rule}
            accounts={accounts}
            cards={cards}
            categories={categories}
            rateRules={rateRules}
            currentMonth={currentMonth}
          />
        ))}
      </div>
    </section>
  );
}

function CardRuleGroup({
  card,
  rules,
  accounts,
  cards,
  categories,
  rateRules,
  currentMonth,
}: {
  card: Card;
  rules: Rule[];
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  rateRules: RateRule[];
  currentMonth: string;
}) {
  const paymentAccount =
    accounts.find(
      (account) =>
        account.id ===
        card.payment_account_id,
    );

  const activeRules =
    rules.filter(
      (rule) => rule.is_active,
    );

  const activeMonthlyRules =
    activeRules.filter(
      (rule) =>
        rule.recurrence_frequency ===
        "monthly",
    );

  const activeYearlyRules =
    activeRules.filter(
      (rule) =>
        rule.recurrence_frequency ===
        "yearly",
    );

  const monthlyAmount =
    activeMonthlyRules.reduce(
      (sum, rule) =>
        sum + rule.amount,
      0,
    );

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] bg-slate-50/80 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-gray-900">
                {card.name}
              </h3>

              {!card.is_active ? (
                <Badge tone="warn">
                  카드 비활성
                </Badge>
              ) : null}

              <Badge>
                결제일{" "}
                {card.payment_day}일
              </Badge>
            </div>

            <p className="mt-2 text-xs leading-5 text-gray-500">
              출금계좌{" "}
              {paymentAccount?.name ??
                "확인 필요"}
              {" · "}
              등록 {rules.length}건
              {" · "}
              활성{" "}
              {activeRules.length}건
            </p>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-right">
              <p className="text-[11px] font-medium text-gray-500">
                매월 반복
              </p>
              <p className="mt-0.5 text-sm font-bold text-gray-900">
                {won(monthlyAmount)}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-400">
                {
                  activeMonthlyRules.length
                }
                건
              </p>
            </div>

            {activeYearlyRules.length >
            0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-right">
                <p className="text-[11px] font-medium text-gray-500">
                  연간 반복
                </p>
                <p className="mt-0.5 text-sm font-bold text-gray-900">
                  {
                    activeYearlyRules.length
                  }
                  건
                </p>
                <p className="mt-0.5 text-[10px] text-gray-400">
                  해당 월에만 반영
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="divide-y divide-[var(--border)] px-4 sm:px-5">
        {rules.map((rule) => (
          <RuleRow
            key={rule.id}
            mode="card"
            rule={rule}
            accounts={accounts}
            cards={cards}
            categories={categories}
            rateRules={rateRules}
            currentMonth={
              currentMonth
            }
          />
        ))}
      </div>
    </section>
  );
}

export function RecurringManager({
  mode,
  rules,
  accounts,
  cards,
  categories,
  rateRules,
  currentMonth,
}: Props) {
  const [groupBy, setGroupBy] =
    useState<RecurringGroupBy>(
      mode === "card" ? "card" : "default",
    );

  const hasRequiredSettings =
    mode === "card"
      ? cards.some(
          (card) =>
            card.is_active,
        ) &&
        categories.some(
          (category) =>
            category.is_active &&
            category.transaction_type ===
              "expense",
        )
      : accounts.some(
          (account) =>
            account.is_active,
        ) &&
        categories.some(
          (category) =>
            category.is_active &&
            (
              category.transaction_type ===
                "income" ||
              category.transaction_type ===
                "expense"
            ),
        );

  const categoryGroups =
    groupRulesByCategory(
      rules,
      categories,
    );
  const expenseNatureGroups =
    groupRulesByExpenseNature(rules);

  const cardRulesWithMissingConnection =
    rules.filter(
      (rule) =>
        !cards.some(
          (card) =>
            card.id === rule.card_id,
        ),
    );

  return (
    <>
      {!hasRequiredSettings ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {mode === "card"
            ? "카드 정기 결제를 등록하려면 먼저 설정에서 활성 카드와 지출 카테고리를 준비해주세요."
            : "일반 정기 결제를 등록하려면 먼저 설정에서 활성 계좌와 카테고리를 준비해주세요."}
        </div>
      ) : null}

      <CreateRuleForm
        mode={mode}
        accounts={accounts}
        cards={cards}
        categories={categories}
        rateRules={rateRules}
        currentMonth={currentMonth}
      />

      {rules.length === 0 ? (
        <div className="mt-6 py-10 text-center">
          <p className="text-sm text-gray-500">
            {mode === "card"
              ? "아직 등록된 카드 정기 결제가 없습니다."
              : "아직 등록된 일반 정기 결제가 없습니다."}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {mode === "card"
              ? "구독료·보험료처럼 카드로 반복 결제되는 항목을 등록할 수 있습니다."
              : "정기 수입과 계좌로 직접 입출금되는 정기 지출을 등록할 수 있습니다."}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex justify-end">
            <label className="flex w-full items-center justify-end gap-3 text-sm font-medium sm:w-auto">
              <span className="shrink-0">
                그룹 기준
              </span>
              <select
                value={groupBy}
                onChange={(event) => {
                  const value =
                    event.currentTarget.value as RecurringGroupBy;
                  setGroupBy(value);
                }}
                className="w-44 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              >
                {mode === "general" ? (
                  <option value="default">
                    기본 보기
                  </option>
                ) : (
                  <option value="card">
                    카드별
                  </option>
                )}
                <option value="category">
                  카테고리별
                </option>
                <option value="expenseNature">
                  지출 성격별
                </option>
              </select>
            </label>
          </div>

          {groupBy === "card" &&
          mode === "card" ? (
            <div className="mt-4 space-y-4">
              {cards
                .filter((card) =>
                  rules.some(
                    (rule) =>
                      rule.card_id ===
                      card.id,
                  ),
                )
                .map((card) => (
                  <CardRuleGroup
                    key={card.id}
                    card={card}
                    rules={rules.filter(
                      (rule) =>
                        rule.card_id ===
                        card.id,
                    )}
                    accounts={accounts}
                    cards={cards}
                    categories={categories}
                    rateRules={rateRules}
                    currentMonth={currentMonth}
                  />
                ))}

              {cardRulesWithMissingConnection.length > 0 ? (
                <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white">
                  <div className="border-b border-amber-200 bg-amber-50 px-4 py-4">
                    <p className="font-bold text-amber-900">
                      카드 연결 확인 필요
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      현재 카드 목록에서 찾을 수 없는 정기 결제 항목입니다.
                    </p>
                  </div>

                  <div className="divide-y divide-[var(--border)] px-4">
                    {cardRulesWithMissingConnection.map(
                      (rule) => (
                        <RuleRow
                          key={rule.id}
                          mode="card"
                          rule={rule}
                          accounts={accounts}
                          cards={cards}
                          categories={categories}
                          rateRules={rateRules}
                          currentMonth={currentMonth}
                        />
                      ),
                    )}
                  </div>
                </section>
              ) : null}
            </div>
          ) : groupBy === "category" ? (
            <div className="mt-4 space-y-4">
              {categoryGroups.map((group) => (
                <RuleGroupSection
                  key={group.key}
                  title={group.title}
                  rules={group.rules}
                  mode={mode}
                  accounts={accounts}
                  cards={cards}
                  categories={categories}
                  rateRules={rateRules}
                  currentMonth={currentMonth}
                />
              ))}
            </div>
          ) : groupBy === "expenseNature" ? (
            <div className="mt-4 space-y-4">
              {expenseNatureGroups.map((group) => (
                <RuleGroupSection
                  key={group.key}
                  title={group.title}
                  rules={group.rules}
                  mode={mode}
                  accounts={accounts}
                  cards={cards}
                  categories={categories}
                  rateRules={rateRules}
                  currentMonth={currentMonth}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[var(--border)]">
              {rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  mode={mode}
                  rule={rule}
                  accounts={accounts}
                  cards={cards}
                  categories={categories}
                  rateRules={rateRules}
                  currentMonth={currentMonth}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
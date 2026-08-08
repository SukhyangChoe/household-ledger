"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createRecurringRule,
  deleteRecurringRule,
  toggleRecurringRuleActive,
  updateRecurringRule,
  type RecurringActionState,
} from "@/app/recurring/actions";
import { Badge } from "@/components/ui";
import {
  occurrenceProgress,
} from "@/domain/recurring";
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

type Props = {
  rules: Rule[];
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  rateRules: RateRule[];
  currentMonth: string;
};

type FormFieldsProps = {
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
  accounts,
  cards,
  categories,
  rateRules,
  currentMonth,
  initialRule,
}: FormFieldsProps) {
  const initialTransactionType:
    RecurringTransactionType =
      initialRule?.transaction_type ===
      "income"
        ? "income"
        : "expense";

  const initialPaymentMethod:
    PaymentMethod =
      initialRule?.card_id
        ? "card"
        : "account";

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
        card.id === initialRule?.card_id,
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

              if (value === "income") {
                setPaymentMethod(
                  "account",
                );
              }

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

        <label className="text-sm font-medium">
          시작 월
          <input
            name="startMonth"
            type="month"
            defaultValue={
              initialRule?.start_month.slice(
                0,
                7,
              ) ?? currentMonth
            }
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

        <label className="text-sm font-medium">
          결제 방식
          <select
            name="paymentMethod"
            value={paymentMethod}
            onChange={(event) => {
              const value =
                event.currentTarget.value;

              if (
                value === "account" ||
                (
                  value === "card" &&
                  transactionType ===
                    "expense"
                )
              ) {
                setPaymentMethod(value);
              }
            }}
            className={inputClassName}
          >
            <option value="account">
              계좌
            </option>

            {transactionType ===
            "expense" ? (
              <option value="card">
                카드
              </option>
            ) : null}
          </select>
        </label>

        {paymentMethod ===
        "account" ? (
          <>
            <label className="text-sm font-medium">
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

            <label className="text-sm font-medium">
              매월 반영일
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
          </>
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
                    {card.name} · 매월{" "}
                    {card.payment_day}일
                    {card.is_active
                      ? ""
                      : " · 비활성"}
                  </option>
                ),
              )}
            </select>

            <span className="mt-1 block text-xs font-normal text-gray-500">
              카드 설정의 결제일과 결제 계좌가 자동 적용됩니다.
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
  accounts,
  cards,
  categories,
  rateRules,
  currentMonth,
}: Omit<Props, "rules">) {
  const formRef =
    useRef<HTMLFormElement>(null);

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
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-4 rounded-2xl border border-[var(--border)] bg-gray-50 p-4"
    >
      <p className="font-semibold">
        새 정기 항목 등록
      </p>

      <div className="mt-4">
        <FormFields
          accounts={accounts}
          cards={cards}
          categories={categories}
          rateRules={rateRules}
          currentMonth={currentMonth}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending
          ? "등록 중..."
          : "정기 항목 등록"}
      </button>

      <ActionMessage state={state} />
    </form>
  );
}

function RuleRow({
  rule,
  accounts,
  cards,
  categories,
  rateRules,
  currentMonth,
}: {
  rule: Rule;
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  rateRules: RateRule[];
  currentMonth: string;
}) {
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

  const account = accounts.find(
    (item) =>
      item.id === rule.account_id,
  );
  const card = cards.find(
    (item) =>
      item.id === rule.card_id,
  );
  const category = categories.find(
    (item) =>
      item.id === rule.category_id,
  );

  const progress =
    rule.show_occurrence_progress
      ? occurrenceProgress(
          currentMonth,
          rule.start_month.slice(0, 7),
          rule.end_month?.slice(
            0,
            7,
          ) ?? null,
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

  const connectionText = card
    ? `${card.name} · ${card.payment_day}일`
    : account
      ? `${account.name} · ${rule.payment_day}일`
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
          <form action={activeAction}>
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

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-gray-600">
          정기 항목 수정
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

          <ActionMessage
            state={updateState}
          />
        </form>
      </details>
    </div>
  );
}

export function RecurringManager({
  rules,
  accounts,
  cards,
  categories,
  rateRules,
  currentMonth,
}: Props) {
  const hasRequiredSettings =
    accounts.some(
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

  return (
    <>
      {!hasRequiredSettings ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          정기 항목을 등록하려면 먼저 설정에서 활성 계좌와 카테고리를 준비해주세요.
        </div>
      ) : null}

      <CreateRuleForm
        accounts={accounts}
        cards={cards}
        categories={categories}
        rateRules={rateRules}
        currentMonth={currentMonth}
      />

      <div className="mt-6 divide-y divide-[var(--border)]">
        {rules.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-500">
              아직 등록된 정기 항목이 없습니다.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              정기 수입·정기 지출·할부를 같은 방식으로 등록할 수 있습니다.
            </p>
          </div>
        ) : (
          rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              accounts={accounts}
              cards={cards}
              categories={categories}
              rateRules={rateRules}
              currentMonth={currentMonth}
            />
          ))
        )}
      </div>
    </>
  );
}

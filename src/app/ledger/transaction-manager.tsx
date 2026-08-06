"use client";

import { useActionState, useState } from "react";

import {
  changeTransactionStatus,
  createTransaction,
  deletePlannedTransaction,
  updateTransaction,
  type TransactionActionState,
} from "@/app/ledger/actions";
import { Badge } from "@/components/ui";
import type { Database } from "@/types/database.types";

type Account =
  Database["public"]["Tables"]["accounts"]["Row"];
type CardRow =
  Database["public"]["Tables"]["cards"]["Row"];
type Category =
  Database["public"]["Tables"]["categories"]["Row"];
type RateRule =
  Database["public"]["Tables"]["rate_rules"]["Row"];
type Transaction =
  Database["public"]["Tables"]["transactions"]["Row"];
type TransactionType = "income" | "expense";
type PaymentMethod = "account" | "card";

type Props = {
  accounts: Account[];
  cards: CardRow[];
  categories: Category[];
  rateRules: RateRule[];
  transactions: Transaction[];
  defaultEffectiveDate: string;
};

const initialState: TransactionActionState = {
  status: "idle",
  message: "",
  resetKey: "initial",
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const ownerLabels = {
  wife: "아내",
  husband: "남편",
  joint: "공동",
} as const;

const statusLabels = {
  planned: "예정",
  confirmed: "확정",
  cancelled: "취소",
} as const;

const fundPurposeLabels = {
  living: "생활비",
  investment: "투자",
} as const;

const expenseNatureLabels = {
  fixed: "고정",
  variable: "변동",
  irregular: "비정기",
} as const;

function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatRate(rateBps: number) {
  return `${(rateBps / 100).toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
  })}%`;
}

function formatDate(value: string) {
  return value.replaceAll("-", ".");
}

function ActionMessage({
  state,
}: {
  state: TransactionActionState;
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

function TransactionFields({
  accounts,
  cards,
  categories,
  rateRules,
  defaultEffectiveDate,
  pending,
}: Omit<Props, "transactions"> & {
  pending: boolean;
}) {
  const [transactionType, setTransactionType] =
    useState<TransactionType>("expense");
  const [selectedCategoryId, setSelectedCategoryId] =
    useState("");
  const [selectedAccountId, setSelectedAccountId] =
    useState("");
  const [selectedRateRuleId, setSelectedRateRuleId] =
    useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("account");
  const [fundPurpose, setFundPurpose] =
    useState("living");
  const [expenseNature, setExpenseNature] =
    useState("variable");
  const [ownerType, setOwnerType] = useState("wife");

  const activeAccounts = accounts.filter(
    (account) => account.is_active,
  );
  const activeAccountIds = new Set(
    activeAccounts.map((account) => account.id),
  );
  const activeCards = cards.filter(
    (card) =>
      card.is_active &&
      activeAccountIds.has(card.payment_account_id),
  );
  const availableCategories = categories.filter(
    (category) =>
      category.is_active &&
      category.transaction_type === transactionType,
  );
  const currentRateRules = rateRules.filter(
    (rateRule) =>
      rateRule.is_active && rateRule.valid_to === null,
  );

  function changeCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);

    const category = categories.find(
      (item) => item.id === categoryId,
    );

    if (!category) {
      return;
    }

    if (category.transaction_type === "income") {
      const defaultAccount = accounts.find(
        (account) =>
          account.id === category.default_account_id,
      );

      setSelectedAccountId(
        category.default_account_id ?? "",
      );
      setSelectedRateRuleId(
        category.rate_rule_id ?? "",
      );

      if (defaultAccount) {
        setOwnerType(defaultAccount.owner_type);
      }
    } else {
      setFundPurpose(
        category.suggested_fund_purpose ?? "living",
      );
      setExpenseNature(
        category.suggested_expense_nature ?? "variable",
      );
    }
  }

  function changeType(type: TransactionType) {
    setTransactionType(type);
    setSelectedCategoryId("");
    setSelectedAccountId("");
    setSelectedRateRuleId("");
    setPaymentMethod("account");
    setFundPurpose("living");
    setExpenseNature("variable");
    setOwnerType("wife");
  }

  const unavailable =
    availableCategories.length === 0 ||
    (transactionType === "income" &&
      (activeAccounts.length === 0 ||
        currentRateRules.length === 0)) ||
    (transactionType === "expense" &&
      activeAccounts.length === 0 &&
      activeCards.length === 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium">
          구분
          <select
            name="transactionType"
            value={transactionType}
            onChange={(event) => {
              changeType(
                event.target.value as TransactionType,
              );
            }}
            className={inputClassName}
          >
            <option value="expense">지출</option>
            <option value="income">수입</option>
          </select>
        </label>

        <label className="text-sm font-medium">
          반영일
          <input
            name="effectiveDate"
            type="date"
            defaultValue={defaultEffectiveDate}
            required
            className={inputClassName}
          />
        </label>

        <label className="text-sm font-medium">
          상태
          <select
            name="status"
            defaultValue="confirmed"
            className={inputClassName}
          >
            <option value="confirmed">확정</option>
            <option value="planned">예정</option>
          </select>
        </label>

        <label className="text-sm font-medium">
          카테고리
          <select
            name="categoryId"
            value={selectedCategoryId}
            onChange={(event) => {
              changeCategory(event.target.value);
            }}
            required
            className={inputClassName}
          >
            <option value="">카테고리 선택</option>

            {availableCategories.map((category) => (
              <option
                key={category.id}
                value={category.id}
              >
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          거래명
          <input
            name="name"
            type="text"
            maxLength={100}
            placeholder={
              transactionType === "income"
                ? "예: 남편 8월 월급"
                : "예: 8월 관리비"
            }
            required
            className={inputClassName}
          />
        </label>

        <label className="text-sm font-medium">
          금액
          <input
            name="amount"
            type="text"
            inputMode="numeric"
            placeholder="예: 500000"
            required
            className={inputClassName}
          />
        </label>
      </div>

      {transactionType === "income" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-medium">
            수입 소유자
            <select
              name="ownerType"
              value={ownerType}
              onChange={(event) => {
                setOwnerType(event.target.value);
              }}
              className={inputClassName}
            >
              <option value="wife">아내</option>
              <option value="husband">남편</option>
              <option value="joint">공동</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            입금 계좌
            <select
              name="accountId"
              value={selectedAccountId}
              onChange={(event) => {
                const nextAccountId = event.target.value;
                const nextAccount = accounts.find(
                  (account) => account.id === nextAccountId,
                );

                setSelectedAccountId(nextAccountId);

                if (nextAccount) {
                  setOwnerType(nextAccount.owner_type);
                }
              }}
              required
              className={inputClassName}
            >
              <option value="">계좌 선택</option>

              {activeAccounts.map((account) => (
                <option
                  key={account.id}
                  value={account.id}
                >
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            생활비 반영률
            <select
              name="rateRuleId"
              value={selectedRateRuleId}
              onChange={(event) => {
                setSelectedRateRuleId(
                  event.target.value,
                );
              }}
              required
              className={inputClassName}
            >
              <option value="">반영률 선택</option>

              {currentRateRules.map((rateRule) => (
                <option
                  key={rateRule.id}
                  value={rateRule.id}
                >
                  {rateRule.name} ·{" "}
                  {formatRate(rateRule.rate_bps)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-medium">
              결제 수단
              <select
                name="paymentMethod"
                value={paymentMethod}
                onChange={(event) => {
                  setPaymentMethod(
                    event.target.value as PaymentMethod,
                  );
                }}
                className={inputClassName}
              >
                <option value="account">
                  계좌 직접 결제
                </option>
                <option value="card">카드 결제</option>
              </select>
            </label>

            {paymentMethod === "account" ? (
              <label className="text-sm font-medium">
                지출 계좌
                <select
                  name="accountId"
                  required
                  className={inputClassName}
                >
                  <option value="">계좌 선택</option>

                  {activeAccounts.map((account) => (
                    <option
                      key={account.id}
                      value={account.id}
                    >
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="text-sm font-medium">
                결제 카드
                <select
                  name="cardId"
                  required
                  className={inputClassName}
                >
                  <option value="">카드 선택</option>

                  {activeCards.map((card) => (
                    <option
                      key={card.id}
                      value={card.id}
                    >
                      {card.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="text-sm font-medium">
              자금 목적
              <select
                name="fundPurpose"
                value={fundPurpose}
                onChange={(event) => {
                  setFundPurpose(event.target.value);
                }}
                className={inputClassName}
              >
                <option value="living">생활비</option>
                <option value="investment">투자</option>
              </select>
            </label>

            <label className="text-sm font-medium">
              지출 성격
              <select
                name="expenseNature"
                value={expenseNature}
                onChange={(event) => {
                  setExpenseNature(event.target.value);
                }}
                className={inputClassName}
              >
                <option value="fixed">고정</option>
                <option value="variable">변동</option>
                <option value="irregular">비정기</option>
              </select>
            </label>
          </div>

          {paymentMethod === "card" ? (
            <p className="mt-3 text-xs leading-5 text-gray-500">
              카드 거래의 반영일은 사용일이 아니라 실제
              카드대금 결제일입니다. 출금 계좌는 카드 설정에서
              자동으로 가져옵니다.
            </p>
          ) : null}
        </>
      )}

      <label className="mt-4 block text-sm font-medium">
        메모
        <input
          name="memo"
          type="text"
          placeholder="선택 입력"
          className={inputClassName}
        />
      </label>

      {unavailable ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          이 유형의 거래를 등록하려면 활성 카테고리,
          계좌와 필요한 설정값을 먼저 등록해주세요.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || unavailable}
        className="mt-4 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "등록 중..." : "거래 등록"}
      </button>
    </>
  );
}

function CreateTransactionForm(props: Props) {
  const [state, formAction, pending] = useActionState(
    createTransaction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-[var(--border)] bg-gray-50 p-4"
    >
      <p className="font-semibold">새 거래 등록</p>

      <div className="mt-4">
        <TransactionFields
          key={state.resetKey}
          accounts={props.accounts}
          cards={props.cards}
          categories={props.categories}
          rateRules={props.rateRules}
          defaultEffectiveDate={
            props.defaultEffectiveDate
          }
          pending={pending}
        />
      </div>

      <ActionMessage state={state} />
    </form>
  );
}

function TransactionEditForm({
  transaction,
  accounts,
  cards,
  categories,
  rateRules,
}: {
  transaction: Transaction;
  accounts: Account[];
  cards: CardRow[];
  categories: Category[];
  rateRules: RateRule[];
}) {
  const [state, formAction, pending] = useActionState(
    updateTransaction,
    initialState,
  );

  const [categoryId, setCategoryId] = useState(
    transaction.category_id ?? "",
  );
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>(
      transaction.card_id ? "card" : "account",
    );
  const [fundPurpose, setFundPurpose] = useState(
    transaction.fund_purpose ?? "living",
  );
  const [expenseNature, setExpenseNature] = useState(
    transaction.expense_nature ?? "variable",
  );
  const [accountId, setAccountId] = useState(
    transaction.account_id ?? "",
  );
  const [rateRuleId, setRateRuleId] = useState(
    transaction.applied_rate_rule_id ?? "",
  );
  const [ownerType, setOwnerType] = useState(
    transaction.owner_type,
  );

  const selectableCategories = categories.filter(
    (category) =>
      category.transaction_type ===
        transaction.transaction_type &&
      (category.is_active ||
        category.id === transaction.category_id),
  );

  const selectableAccounts = accounts.filter(
    (account) =>
      account.is_active ||
      account.id === transaction.account_id,
  );

  const selectableCards = cards.filter(
    (card) =>
      card.is_active || card.id === transaction.card_id,
  );

  const selectableRateRules = rateRules.filter(
    (rateRule) =>
      (rateRule.is_active && rateRule.valid_to === null) ||
      rateRule.id === transaction.applied_rate_rule_id,
  );

  function changeCategory(nextCategoryId: string) {
    setCategoryId(nextCategoryId);

    const category = categories.find(
      (item) => item.id === nextCategoryId,
    );

    if (!category) {
      return;
    }

    if (category.transaction_type === "income") {
      const defaultAccount = accounts.find(
        (account) =>
          account.id === category.default_account_id,
      );

      setAccountId(category.default_account_id ?? "");
      setRateRuleId(category.rate_rule_id ?? "");

      if (defaultAccount) {
        setOwnerType(defaultAccount.owner_type);
      }
    } else {
      setFundPurpose(
        category.suggested_fund_purpose ?? "living",
      );
      setExpenseNature(
        category.suggested_expense_nature ?? "variable",
      );
    }
  }

  return (
    <form
      action={formAction}
      className="mt-3 rounded-xl bg-gray-50 p-4"
    >
      <input
        type="hidden"
        name="transactionId"
        value={transaction.id}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium">
          반영일
          <input
            name="effectiveDate"
            type="date"
            defaultValue={transaction.effective_date}
            required
            className={inputClassName}
          />
        </label>

        <label className="text-sm font-medium">
          카테고리
          <select
            name="categoryId"
            value={categoryId}
            onChange={(event) => {
              changeCategory(event.target.value);
            }}
            required
            className={inputClassName}
          >
            {selectableCategories.map((category) => (
              <option
                key={category.id}
                value={category.id}
              >
                {category.name}
                {!category.is_active ? " (비활성)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium">
          금액
          <input
            name="amount"
            type="text"
            inputMode="numeric"
            defaultValue={transaction.amount}
            required
            className={inputClassName}
          />
        </label>
      </div>

      <label className="mt-4 block text-sm font-medium">
        거래명
        <input
          name="name"
          type="text"
          maxLength={100}
          defaultValue={transaction.name}
          required
          className={inputClassName}
        />
      </label>

      {transaction.transaction_type === "income" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-medium">
            수입 소유자
            <select
              name="ownerType"
              value={ownerType}
              onChange={(event) => {
                setOwnerType(event.target.value as Account["owner_type"]);
              }}
              className={inputClassName}
            >
              <option value="wife">아내</option>
              <option value="husband">남편</option>
              <option value="joint">공동</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            입금 계좌
            <select
              name="accountId"
              value={accountId}
              onChange={(event) => {
                const nextAccountId = event.target.value;
                const nextAccount = accounts.find(
                  (account) => account.id === nextAccountId,
                );

                setAccountId(nextAccountId);

                if (nextAccount) {
                  setOwnerType(nextAccount.owner_type);
                }
              }}
              required
              className={inputClassName}
            >
              {selectableAccounts.map((account) => (
                <option
                  key={account.id}
                  value={account.id}
                >
                  {account.name}
                  {!account.is_active ? " (비활성)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            생활비 반영률
            <select
              name="rateRuleId"
              value={rateRuleId}
              onChange={(event) => {
                setRateRuleId(event.target.value);
              }}
              required
              className={inputClassName}
            >
              {selectableRateRules.map((rateRule) => (
                <option
                  key={rateRule.id}
                  value={rateRule.id}
                >
                  {rateRule.name} ·{" "}
                  {formatRate(rateRule.rate_bps)}
                  {!rateRule.is_active || rateRule.valid_to
                    ? " (과거 버전)"
                    : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium">
            결제 수단
            <select
              name="paymentMethod"
              value={paymentMethod}
              onChange={(event) => {
                setPaymentMethod(
                  event.target.value as PaymentMethod,
                );
              }}
              className={inputClassName}
            >
              <option value="account">계좌 직접 결제</option>
              <option value="card">카드 결제</option>
            </select>
          </label>

          {paymentMethod === "account" ? (
            <label className="text-sm font-medium">
              지출 계좌
              <select
                name="accountId"
                defaultValue={transaction.account_id ?? ""}
                required
                className={inputClassName}
              >
                <option value="">계좌 선택</option>

                {selectableAccounts.map((account) => (
                  <option
                    key={account.id}
                    value={account.id}
                  >
                    {account.name}
                    {!account.is_active
                      ? " (비활성)"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-sm font-medium">
              결제 카드
              <select
                name="cardId"
                defaultValue={transaction.card_id ?? ""}
                required
                className={inputClassName}
              >
                <option value="">카드 선택</option>

                {selectableCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                    {!card.is_active ? " (비활성)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="text-sm font-medium">
            자금 목적
            <select
              name="fundPurpose"
              value={fundPurpose}
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (value === "living" || value === "investment") {
                  setFundPurpose(value);
                }
              }}
              className={inputClassName}
            >
              <option value="living">생활비</option>
              <option value="investment">투자</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            지출 성격
            <select
              name="expenseNature"
              value={expenseNature}
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (value === "fixed" || value === "variable" || value === "irregular") {
                  setExpenseNature(value);
                }
              }}
              className={inputClassName}
            >
              <option value="fixed">고정</option>
              <option value="variable">변동</option>
              <option value="irregular">비정기</option>
            </select>
          </label>
        </div>
      )}

      <label className="mt-4 block text-sm font-medium">
        메모
        <input
          name="memo"
          type="text"
          defaultValue={transaction.memo ?? ""}
          className={inputClassName}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "저장 중..." : "수정 저장"}
      </button>

      <ActionMessage state={state} />
    </form>
  );
}

function TransactionItem({
  transaction,
  accounts,
  cards,
  categories,
  rateRules,
}: {
  transaction: Transaction;
  accounts: Account[];
  cards: CardRow[];
  categories: Category[];
  rateRules: RateRule[];
}) {
  const [statusState, statusAction, statusPending] =
    useActionState(
      changeTransactionStatus,
      initialState,
    );
  const [deleteState, deleteAction, deletePending] =
    useActionState(
      deletePlannedTransaction,
      initialState,
    );

  const account = accounts.find(
    (item) => item.id === transaction.account_id,
  );
  const card = cards.find(
    (item) => item.id === transaction.card_id,
  );
  const category = categories.find(
    (item) => item.id === transaction.category_id,
  );

  const editable =
    !transaction.settlement_completed_at &&
    (transaction.status === "planned" ||
      transaction.status === "confirmed") &&
    transaction.transaction_type !== "transfer";

  return (
    <article className="py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">
              {transaction.name}
            </p>

            <Badge
              tone={
                transaction.status === "confirmed"
                  ? "good"
                  : transaction.status === "planned"
                    ? "warn"
                    : "neutral"
              }
            >
              {statusLabels[transaction.status]}
            </Badge>

            <Badge>
              {transaction.transaction_type === "income"
                ? "수입"
                : transaction.transaction_type === "expense"
                  ? "지출"
                  : "이체"}
            </Badge>
          </div>

          <p className="mt-2 text-sm text-gray-600">
            {formatDate(transaction.effective_date)} ·{" "}
            {category?.name ?? "카테고리 없음"} ·{" "}
            {ownerLabels[transaction.owner_type]}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {card
              ? `${card.name} → ${account?.name ?? "출금 계좌 없음"}`
              : account?.name ?? "연결 계좌 없음"}
          </p>

          {transaction.transaction_type === "income" ? (
            <p className="mt-1 text-xs text-gray-500">
              생활비{" "}
              {formatRate(
                transaction.applied_living_rate_bps ?? 0,
              )}
              · 배정액{" "}
              {won(transaction.living_allocated_amount ?? 0)}
              {transaction.is_asset_income_snapshot
                ? " · 자산소득"
                : ""}
            </p>
          ) : transaction.transaction_type === "expense" ? (
            <p className="mt-1 text-xs text-gray-500">
              {fundPurposeLabels[
                transaction.fund_purpose ?? "living"
              ]}
              ·{" "}
              {expenseNatureLabels[
                transaction.expense_nature ?? "variable"
              ]}
            </p>
          ) : null}

          {transaction.memo ? (
            <p className="mt-1 text-xs text-gray-400">
              {transaction.memo}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
          <strong
            className={
              transaction.transaction_type === "income"
                ? "text-xl text-emerald-700"
                : "text-xl"
            }
          >
            {transaction.transaction_type === "income"
              ? "+"
              : "-"}
            {won(transaction.amount)}
          </strong>

          <div className="flex flex-wrap gap-2">
            {transaction.status === "planned" ? (
              <form action={statusAction}>
                <input
                  type="hidden"
                  name="transactionId"
                  value={transaction.id}
                />
                <input
                  type="hidden"
                  name="nextStatus"
                  value="confirmed"
                />
                <button
                  type="submit"
                  disabled={statusPending}
                  className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-60"
                >
                  확정
                </button>
              </form>
            ) : null}

            {(transaction.status === "planned" ||
              transaction.status === "confirmed") &&
            !transaction.settlement_completed_at ? (
              <form
                action={statusAction}
                onSubmit={(event) => {
                  if (
                    !window.confirm(
                      `"${transaction.name}" 거래를 취소 처리할까요?`,
                    )
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                <input
                  type="hidden"
                  name="transactionId"
                  value={transaction.id}
                />
                <input
                  type="hidden"
                  name="nextStatus"
                  value="cancelled"
                />
                <button
                  type="submit"
                  disabled={statusPending}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:opacity-60"
                >
                  취소 처리
                </button>
              </form>
            ) : null}

            {transaction.status === "planned" &&
            !transaction.recurring_rule_id &&
            !transaction.settlement_completed_at ? (
              <form
                action={deleteAction}
                onSubmit={(event) => {
                  if (
                    !window.confirm(
                      `"${transaction.name}" 예정 거래를 완전히 삭제할까요?`,
                    )
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                <input
                  type="hidden"
                  name="transactionId"
                  value={transaction.id}
                />
                <button
                  type="submit"
                  disabled={deletePending}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-60"
                >
                  삭제
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>

      <ActionMessage state={statusState} />
      <ActionMessage state={deleteState} />

      {editable ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-gray-600">
            거래 정보 수정
          </summary>

          <TransactionEditForm
            transaction={transaction}
            accounts={accounts}
            cards={cards}
            categories={categories}
            rateRules={rateRules}
          />
        </details>
      ) : null}
    </article>
  );
}

export function TransactionManager(props: Props) {
  return (
    <>
      <CreateTransactionForm {...props} />

      <div className="mt-5 divide-y divide-[var(--border)]">
        {props.transactions.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-500">
              이 달에 등록된 거래가 없습니다.
            </p>
          </div>
        ) : (
          props.transactions.map((transaction) => (
            <TransactionItem
              key={transaction.id}
              transaction={transaction}
              accounts={props.accounts}
              cards={props.cards}
              categories={props.categories}
              rateRules={props.rateRules}
            />
          ))
        )}
      </div>
    </>
  );
}

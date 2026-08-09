"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import {
  changeTransactionStatus,
  createTransaction,
  deletePlannedTransaction,
  updateTransaction,
  type TransactionActionState,
} from "@/app/ledger/actions";
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
  month: string;
};

type TransactionLookupProps = Pick<
  Props,
  "accounts" | "cards" | "categories" | "rateRules"
>;

const initialState: TransactionActionState = {
  status: "idle",
  message: "",
  resetKey: "initial",
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const weekdayLabels = [
  "일",
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
] as const;

function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatRate(rateBps: number) {
  return `${(rateBps / 100).toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
  })}%`;
}

function getDaysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function buildDate(month: string, day: number) {
  return `${month}-${String(day).padStart(2, "0")}`;
}

function getWeekday(month: string, day: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return weekdayLabels[
    new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay()
  ];
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
}: TransactionLookupProps & {
  defaultEffectiveDate: string;
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
      setSelectedRateRuleId(category.rate_rule_id ?? "");

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
              <option key={category.id} value={category.id}>
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
                <option key={account.id} value={account.id}>
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
                setSelectedRateRuleId(event.target.value);
              }}
              required
              className={inputClassName}
            >
              <option value="">반영률 선택</option>
              {currentRateRules.map((rateRule) => (
                <option key={rateRule.id} value={rateRule.id}>
                  {rateRule.name} · {formatRate(rateRule.rate_bps)}
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
                <option value="account">계좌 직접 결제</option>
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
                    <option key={account.id} value={account.id}>
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
                    <option key={card.id} value={card.id}>
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
              카드 거래의 반영일은 사용일이 아니라 실제 카드대금
              결제일입니다. 출금 계좌는 카드 설정에서 자동으로
              가져옵니다.
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
          이 유형의 거래를 등록하려면 활성 카테고리, 계좌와 필요한
          설정값을 먼저 등록해주세요.
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

function CreateTransactionDialog({
  accounts,
  cards,
  categories,
  rateRules,
  defaultEffectiveDate,
  onClose,
}: TransactionLookupProps & {
  defaultEffectiveDate: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createTransaction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [state.resetKey, state.status, onClose]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10 sm:items-center sm:pt-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-transaction-title"
        className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3
              id="create-transaction-title"
              className="text-lg font-bold"
            >
              새 거래 등록
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              실제 자금이 움직이는 반영일 기준으로 등록합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            aria-label="거래 등록 창 닫기"
          >
            닫기 ✕
          </button>
        </div>

        <form action={formAction} className="p-5">
          <TransactionFields
            key={state.resetKey}
            accounts={accounts}
            cards={cards}
            categories={categories}
            rateRules={rateRules}
            defaultEffectiveDate={defaultEffectiveDate}
            pending={pending}
          />

          {state.status === "error" ? (
            <ActionMessage state={state} />
          ) : null}
        </form>
      </section>
    </div>
  );
}

function TransactionEditForm({
  transaction,
  accounts,
  cards,
  categories,
  rateRules,
  detailsRef,
}: {
  transaction: Transaction;
  detailsRef: RefObject<HTMLDetailsElement | null>;
} & TransactionLookupProps) {
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

  useEffect(() => {
    if (state.status === "success") {
      detailsRef.current?.removeAttribute("open");
    }
  }, [detailsRef, state.status]);

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
    <>
      <form
        action={formAction}
        className="rounded-xl border border-[var(--border)] bg-white p-4"
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
                <option key={category.id} value={category.id}>
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
                  setOwnerType(
                    event.target.value as Account["owner_type"],
                  );
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
                  <option key={account.id} value={account.id}>
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
                  <option key={rateRule.id} value={rateRule.id}>
                    {rateRule.name} · {formatRate(rateRule.rate_bps)}
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
                    <option key={account.id} value={account.id}>
                      {account.name}
                      {!account.is_active ? " (비활성)" : ""}
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
                  if (
                    value === "living" ||
                    value === "investment"
                  ) {
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
                  if (
                    value === "fixed" ||
                    value === "variable" ||
                    value === "irregular"
                  ) {
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
      </form>

      <ActionMessage state={state} />
    </>
  );
}


type ExpenseSummaryGroup = NonNullable<
  Category["expense_summary_group"]
>;
type IncomeSummaryGroup = NonNullable<
  Category["income_summary_group"]
>;

const expenseSummaryGroupLabels: Record<
  ExpenseSummaryGroup,
  string
> = {
  monthly: "월간지출",
  annual: "연간지출",
  variable: "변동지출",
  repayment_saving: "상환·적립",
};

const incomeSummaryGroupLabels: Record<
  IncomeSummaryGroup,
  string
> = {
  earned: "근로소득",
  asset: "자산소득",
  variable: "변동소득",
};

const expenseSummaryGroups: ExpenseSummaryGroup[] = [
  "monthly",
  "annual",
  "variable",
  "repayment_saving",
];

const incomeSummaryGroups: IncomeSummaryGroup[] = [
  "earned",
  "asset",
  "variable",
];

function TransactionItem({
  transaction,
  tone,
  showUnclassified,
  accounts,
  cards,
  categories,
  rateRules,
}: {
  transaction: Transaction;
  tone: "expense" | "income";
  showUnclassified: boolean;
} & TransactionLookupProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

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

  const category = categories.find(
    (item) => item.id === transaction.category_id,
  );

  const expenseSummaryGroup =
    tone === "expense"
      ? category?.expense_summary_group ?? null
      : null;
  const incomeSummaryGroup =
    tone === "income"
      ? category?.income_summary_group ?? null
      : null;

  const summaryGroupLabel =
    tone === "expense"
      ? expenseSummaryGroup
        ? expenseSummaryGroupLabels[expenseSummaryGroup]
        : "미분류"
      : incomeSummaryGroup
        ? incomeSummaryGroupLabels[incomeSummaryGroup]
        : "미분류";

  const editable =
    !transaction.settlement_completed_at &&
    (transaction.status === "planned" ||
      transaction.status === "confirmed") &&
    transaction.transaction_type !== "transfer";

  const canChangeStatus =
    (transaction.status === "planned" ||
      transaction.status === "confirmed") &&
    !transaction.settlement_completed_at;

  const canDelete =
    transaction.status === "planned" &&
    !transaction.recurring_rule_id &&
    !transaction.settlement_completed_at;

  const interactive =
    editable || canChangeStatus || canDelete;

  const desktopGridClass =
    tone === "expense"
      ? showUnclassified
        ? "md:grid-cols-[minmax(140px,1.55fr)_repeat(5,minmax(72px,1fr))]"
        : "md:grid-cols-[minmax(140px,1.55fr)_repeat(4,minmax(78px,1fr))]"
      : showUnclassified
        ? "md:grid-cols-[minmax(140px,1.55fr)_repeat(4,minmax(78px,1fr))]"
        : "md:grid-cols-[minmax(140px,1.55fr)_repeat(3,minmax(86px,1fr))]";

  const nameCell = (
    <div className="flex min-w-0 items-center gap-1.5 px-2 py-1.5">
      <span className="truncate text-xs font-medium text-gray-800 sm:text-sm">
        {transaction.name}
      </span>

      {transaction.status === "planned" ? (
        <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-700">
          예정
        </span>
      ) : null}

      {!expenseSummaryGroup &&
      !incomeSummaryGroup ? (
        <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-gray-500">
          분류 필요
        </span>
      ) : null}

      {interactive ? (
        <span className="ml-auto shrink-0 text-[10px] font-medium text-gray-400 group-open:text-gray-700">
          수정
        </span>
      ) : null}
    </div>
  );

  const amountClassName =
    tone === "income"
      ? "text-emerald-700"
      : "text-gray-900";

  const desktopSummary = (
    <div
      className={`hidden md:grid ${desktopGridClass}`}
    >
      {nameCell}

      {tone === "expense"
        ? expenseSummaryGroups.map((group) => (
            <div
              key={group}
              className="flex items-center justify-end border-l border-black/5 px-2 py-1.5"
            >
              {expenseSummaryGroup === group ? (
                <span
                  className={`text-xs font-semibold tabular-nums sm:text-sm ${amountClassName}`}
                >
                  {won(transaction.amount)}
                </span>
              ) : null}
            </div>
          ))
        : incomeSummaryGroups.map((group) => (
            <div
              key={group}
              className="flex items-center justify-end border-l border-black/5 px-2 py-1.5"
            >
              {incomeSummaryGroup === group ? (
                <span
                  className={`text-xs font-semibold tabular-nums sm:text-sm ${amountClassName}`}
                >
                  {won(transaction.amount)}
                </span>
              ) : null}
            </div>
          ))}

      {showUnclassified ? (
        <div className="flex items-center justify-end border-l border-black/5 px-2 py-1.5">
          {!expenseSummaryGroup &&
          !incomeSummaryGroup ? (
            <span
              className={`text-xs font-semibold tabular-nums sm:text-sm ${amountClassName}`}
            >
              {won(transaction.amount)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const mobileSummary = (
    <div className="flex min-w-0 items-center gap-2 px-2 py-1.5 md:hidden">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-xs font-medium text-gray-800 sm:text-sm">
          {transaction.name}
        </span>

        {transaction.status === "planned" ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-700">
            예정
          </span>
        ) : null}

        {!expenseSummaryGroup &&
        !incomeSummaryGroup ? (
          <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-gray-500">
            분류 필요
          </span>
        ) : null}
      </div>

      <span className="shrink-0 text-[10px] font-medium text-gray-400">
        {summaryGroupLabel}
      </span>

      <span
        className={`shrink-0 text-xs font-semibold tabular-nums sm:text-sm ${amountClassName}`}
      >
        {won(transaction.amount)}
      </span>

      {interactive ? (
        <span className="shrink-0 text-[10px] font-medium text-gray-400 group-open:text-gray-700">
          수정
        </span>
      ) : null}
    </div>
  );

  const summary = (
    <>
      {desktopSummary}
      {mobileSummary}
    </>
  );

  if (!interactive) {
    return (
      <div className="border-b border-black/5 last:border-b-0">
        {summary}
      </div>
    );
  }

  return (
    <details
      ref={detailsRef}
      className="group border-b border-black/5 last:border-b-0"
    >
      <summary className="cursor-pointer list-none transition hover:bg-black/[0.025] [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>

      <div className="border-t border-black/5 bg-white/80 p-3">
        {editable ? (
          <TransactionEditForm
            key={transaction.updated_at}
            transaction={transaction}
            accounts={accounts}
            cards={cards}
            categories={categories}
            rateRules={rateRules}
            detailsRef={detailsRef}
          />
        ) : null}

        {canChangeStatus || canDelete ? (
          <div
            className={
              editable
                ? "mt-3 border-t border-[var(--border)] pt-3"
                : ""
            }
          >
            <p className="mb-2 text-xs font-semibold text-gray-500">
              거래 처리
            </p>

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
                    className="rounded-lg border border-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 disabled:opacity-60"
                  >
                    확정
                  </button>
                </form>
              ) : null}

              {canChangeStatus ? (
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
                    className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60"
                  >
                    취소 처리
                  </button>
                </form>
              ) : null}

              {canDelete ? (
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
                    className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-60"
                  >
                    삭제
                  </button>
                </form>
              ) : null}
            </div>

            <ActionMessage state={statusState} />
            <ActionMessage state={deleteState} />
          </div>
        ) : null}
      </div>
    </details>
  );
}

function TransactionColumn({
  title,
  tone,
  transactions,
  showUnclassified,
  accounts,
  cards,
  categories,
  rateRules,
}: {
  title: "지출" | "수입";
  tone: "expense" | "income";
  transactions: Transaction[];
  showUnclassified: boolean;
} & TransactionLookupProps) {
  const empty = transactions.length === 0;

  return (
    <div
      className={[
        tone === "expense"
          ? "border-t border-[var(--border)] bg-orange-50/20 md:border-l md:border-t-0"
          : "border-t border-[var(--border)] bg-emerald-50/20 md:border-l md:border-t-0",
        empty ? "hidden md:block" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!empty ? (
        <div className="border-b border-black/5 px-2 py-1 text-[11px] font-bold text-gray-500 md:hidden">
          {title}
        </div>
      ) : null}

      {!empty ? (
        <div>
          {transactions.map((transaction) => (
            <TransactionItem
              key={transaction.id}
              transaction={transaction}
              tone={tone}
              showUnclassified={showUnclassified}
              accounts={accounts}
              cards={cards}
              categories={categories}
              rateRules={rateRules}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ExpenseHeader({
  showUnclassified,
}: {
  showUnclassified: boolean;
}) {
  const gridClass = showUnclassified
    ? "grid-cols-[minmax(140px,1.55fr)_repeat(5,minmax(72px,1fr))]"
    : "grid-cols-[minmax(140px,1.55fr)_repeat(4,minmax(78px,1fr))]";

  return (
    <div className="border-l border-[var(--border)] bg-orange-50/70">
      <div className="border-b border-[var(--border)] px-3 py-1.5 text-center text-xs font-bold text-gray-600">
        지출
      </div>
      <div className={`grid ${gridClass} text-[10px] font-semibold text-gray-500`}>
        <div className="px-2 py-1.5">항목</div>
        {expenseSummaryGroups.map((group) => (
          <div
            key={group}
            className="border-l border-black/5 px-1 py-1.5 text-center"
          >
            {expenseSummaryGroupLabels[group]}
          </div>
        ))}
        {showUnclassified ? (
          <div className="border-l border-black/5 px-1 py-1.5 text-center text-amber-700">
            미분류
          </div>
        ) : null}
      </div>
    </div>
  );
}

function IncomeHeader({
  showUnclassified,
}: {
  showUnclassified: boolean;
}) {
  const gridClass = showUnclassified
    ? "grid-cols-[minmax(140px,1.55fr)_repeat(4,minmax(78px,1fr))]"
    : "grid-cols-[minmax(140px,1.55fr)_repeat(3,minmax(86px,1fr))]";

  return (
    <div className="border-l border-[var(--border)] bg-emerald-50/70">
      <div className="border-b border-[var(--border)] px-3 py-1.5 text-center text-xs font-bold text-gray-600">
        수입
      </div>
      <div className={`grid ${gridClass} text-[10px] font-semibold text-gray-500`}>
        <div className="px-2 py-1.5">항목</div>
        {incomeSummaryGroups.map((group) => (
          <div
            key={group}
            className="border-l border-black/5 px-1 py-1.5 text-center"
          >
            {incomeSummaryGroupLabels[group]}
          </div>
        ))}
        {showUnclassified ? (
          <div className="border-l border-black/5 px-1 py-1.5 text-center text-amber-700">
            미분류
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TransactionManager(props: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const daysInMonth = getDaysInMonth(props.month);
  const monthNumber = Number(props.month.slice(5, 7));

  const transactionsByDate = new Map<string, Transaction[]>();
  const categoryMap = new Map(
    props.categories.map((category) => [
      category.id,
      category,
    ]),
  );

  for (const transaction of props.transactions) {
    const existing =
      transactionsByDate.get(transaction.effective_date) ?? [];
    existing.push(transaction);
    transactionsByDate.set(transaction.effective_date, existing);
  }

  const showExpenseUnclassified = props.transactions.some(
    (transaction) => {
      if (
        transaction.transaction_type !== "expense" &&
        transaction.transaction_type !== "transfer"
      ) {
        return false;
      }

      if (!transaction.category_id) {
        return true;
      }

      return !categoryMap.get(transaction.category_id)
        ?.expense_summary_group;
    },
  );

  const showIncomeUnclassified = props.transactions.some(
    (transaction) => {
      if (transaction.transaction_type !== "income") {
        return false;
      }

      if (!transaction.category_id) {
        return true;
      }

      return !categoryMap.get(transaction.category_id)
        ?.income_summary_group;
    },
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">
            {monthNumber}월 일별 거래
          </p>
          <p className="mt-1 text-xs text-gray-500">
            항목명은 고정하고 금액을 집계 분류별 칸에 표시합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="self-start rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm sm:self-auto"
        >
          + 새 거래 등록
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="hidden grid-cols-[72px_minmax(0,1.25fr)_minmax(0,1fr)] bg-gray-50 md:grid">
          <div className="flex items-center justify-center px-2 py-2 text-xs font-bold text-gray-600">
            날짜
          </div>
          <ExpenseHeader
            showUnclassified={showExpenseUnclassified}
          />
          <IncomeHeader
            showUnclassified={showIncomeUnclassified}
          />
        </div>

        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const date = buildDate(props.month, day);
          const weekday = getWeekday(props.month, day);
          const dayTransactions =
            transactionsByDate.get(date) ?? [];
          const expenseTransactions = dayTransactions.filter(
            (transaction) =>
              transaction.transaction_type === "expense" ||
              transaction.transaction_type === "transfer",
          );
          const incomeTransactions = dayTransactions.filter(
            (transaction) =>
              transaction.transaction_type === "income",
          );

          return (
            <div
              key={date}
              className="grid border-t border-[var(--border)] first:border-t-0 md:grid-cols-[72px_minmax(0,1.25fr)_minmax(0,1fr)]"
            >
              <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-2 md:justify-center md:bg-white md:px-2 md:py-1.5">
                <span className="text-sm font-bold md:hidden">
                  {monthNumber}월 {day}일
                </span>
                <span className="hidden text-sm font-bold md:inline">
                  {day}
                </span>
                <span
                  className={`text-xs ${
                    weekday === "일"
                      ? "text-red-500"
                      : weekday === "토"
                        ? "text-blue-500"
                        : "text-gray-400"
                  }`}
                >
                  <span className="md:hidden">
                    · {weekday}요일
                  </span>
                  <span className="hidden md:inline">
                    {weekday}
                  </span>
                </span>
              </div>

              <TransactionColumn
                title="지출"
                tone="expense"
                transactions={expenseTransactions}
                showUnclassified={showExpenseUnclassified}
                accounts={props.accounts}
                cards={props.cards}
                categories={props.categories}
                rateRules={props.rateRules}
              />

              <TransactionColumn
                title="수입"
                tone="income"
                transactions={incomeTransactions}
                showUnclassified={showIncomeUnclassified}
                accounts={props.accounts}
                cards={props.cards}
                categories={props.categories}
                rateRules={props.rateRules}
              />
            </div>
          );
        })}
      </div>

      {createOpen ? (
        <CreateTransactionDialog
          accounts={props.accounts}
          cards={props.cards}
          categories={props.categories}
          rateRules={props.rateRules}
          defaultEffectiveDate={props.defaultEffectiveDate}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}
    </>
  );
}
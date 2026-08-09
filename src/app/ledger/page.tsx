import Link from "next/link";

import { TransactionManager } from "@/app/ledger/transaction-manager";
import { Card } from "@/components/ui";
import { requireCurrentHousehold } from "@/lib/household/current";

function getKoreaToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year",
  )?.value;
  const month = parts.find(
    (part) => part.type === "month",
  )?.value;
  const day = parts.find(
    (part) => part.type === "day",
  )?.value;

  if (!year || !month || !day) {
    throw new Error("현재 날짜를 확인하지 못했습니다.");
  }

  return `${year}-${month}-${day}`;
}

function normalizeMonth(value: string | undefined, today: string) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return today.slice(0, 7);
  }

  const [year, month] = value.split("-").map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return today.slice(0, 7);
  }

  return `${String(year).padStart(4, "0")}-${String(
    month,
  ).padStart(2, "0")}`;
}

function shiftMonth(monthValue: string, offset: number) {
  const [year, month] = monthValue.split("-").map(Number);
  const shifted = new Date(
    Date.UTC(year, month - 1 + offset, 1),
  );

  return `${shifted.getUTCFullYear()}-${String(
    shifted.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

type LedgerPageProps = {
  searchParams: Promise<{
    month?: string;
  }>;
};

export default async function LedgerPage({
  searchParams,
}: LedgerPageProps) {
  const today = getKoreaToday();
  const params = await searchParams;
  const month = normalizeMonth(params.month, today);
  const startDate = `${month}-01`;
  const nextMonth = shiftMonth(month, 1);
  const nextMonthStart = `${nextMonth}-01`;
  const previousMonth = shiftMonth(month, -1);
  const defaultEffectiveDate =
    month === today.slice(0, 7) ? today : startDate;

  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { error: generationError } = await supabase.rpc(
    "generate_recurring_transactions",
    {
      p_household_id: householdId,
      p_target_month: startDate,
    },
  );

  if (generationError) {
    console.error(
      "Failed to generate recurring transactions:",
      generationError,
    );

    throw new Error(
      "선택한 달의 정기 거래를 생성하지 못했습니다.",
    );
  }

  const [
    transactionsResult,
    accountsResult,
    cardsResult,
    categoriesResult,
    rateRulesResult,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("household_id", householdId)
      .in("status", ["planned", "confirmed"])
      .gte("effective_date", startDate)
      .lt("effective_date", nextMonthStart)
      .order("effective_date", { ascending: true })
      .order("created_at", { ascending: true }),

    supabase
      .from("accounts")
      .select("*")
      .eq("household_id", householdId)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true }),

    supabase
      .from("cards")
      .select("*")
      .eq("household_id", householdId)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true }),

    supabase
      .from("categories")
      .select("*")
      .eq("household_id", householdId)
      .order("is_active", { ascending: false })
      .order("transaction_type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),

    supabase
      .from("rate_rules")
      .select("*")
      .eq("household_id", householdId)
      .order("rule_key", { ascending: true })
      .order("valid_from", { ascending: false }),
  ]);

  if (transactionsResult.error) {
    console.error(
      "Failed to load transactions:",
      transactionsResult.error.message,
    );
    throw new Error("거래 내역을 불러오지 못했습니다.");
  }

  if (accountsResult.error) {
    console.error(
      "Failed to load accounts:",
      accountsResult.error.message,
    );
    throw new Error("계좌 정보를 불러오지 못했습니다.");
  }

  if (cardsResult.error) {
    console.error(
      "Failed to load cards:",
      cardsResult.error.message,
    );
    throw new Error("카드 정보를 불러오지 못했습니다.");
  }

  if (categoriesResult.error) {
    console.error(
      "Failed to load categories:",
      categoriesResult.error.message,
    );
    throw new Error("카테고리를 불러오지 못했습니다.");
  }

  if (rateRulesResult.error) {
    console.error(
      "Failed to load rate rules:",
      rateRulesResult.error.message,
    );
    throw new Error("생활비 반영률을 불러오지 못했습니다.");
  }

  const transactions = transactionsResult.data ?? [];
  const accounts = accountsResult.data ?? [];
  const cards = cardsResult.data ?? [];
  const categories = categoriesResult.data ?? [];
  const rateRules = rateRulesResult.data ?? [];

  const confirmedIncome = transactions
    .filter(
      (transaction) =>
        transaction.status === "confirmed" &&
        transaction.transaction_type === "income",
    )
    .reduce(
      (sum, transaction) => sum + transaction.amount,
      0,
    );

  const livingExpense = transactions
    .filter(
      (transaction) =>
        transaction.status === "confirmed" &&
        transaction.transaction_type === "expense" &&
        transaction.fund_purpose === "living",
    )
    .reduce(
      (sum, transaction) => sum + transaction.amount,
      0,
    );

  const investmentExpense = transactions
    .filter(
      (transaction) =>
        transaction.status === "confirmed" &&
        transaction.transaction_type === "expense" &&
        transaction.fund_purpose === "investment",
    )
    .reduce(
      (sum, transaction) => sum + transaction.amount,
      0,
    );

  const unsettledCount = transactions.filter(
    (transaction) =>
      transaction.status === "confirmed" &&
      transaction.settlement_completed_at === null,
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">월별 가계부</h2>
          <p className="mt-1 text-sm text-gray-500">
            카드 사용일이 아닌 실제 결제일 기준입니다.
          </p>
        </div>

        <nav
          className="flex items-center gap-2"
          aria-label="월 이동"
        >
          <Link
            href={`/ledger?month=${previousMonth}`}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"
          >
            이전 달
          </Link>

          <span className="min-w-28 text-center font-semibold">
            {month.replace("-", ".")}
          </span>

          <Link
            href={`/ledger?month=${nextMonth}`}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"
          >
            다음 달
          </Link>
        </nav>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="확정 수입" value={won(confirmedIncome)} />
        <Card title="생활비 지출" value={won(livingExpense)} />
        <Card
          title="투자 목적 비용"
          value={won(investmentExpense)}
        />
        <Card
          title="미정산 표시"
          value={`${unsettledCount}건`}
        />
      </div>

      <Card title="일별 거래 내역">
        <div className="mt-4">
          <TransactionManager
            accounts={accounts}
            cards={cards}
            categories={categories}
            rateRules={rateRules}
            transactions={transactions}
            defaultEffectiveDate={defaultEffectiveDate}
            month={month}
          />
        </div>
      </Card>
    </div>
  );
}
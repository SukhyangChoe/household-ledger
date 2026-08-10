import Link from "next/link";

import { SettlementManager } from "@/app/settlements/settlement-manager";
import { Card } from "@/components/ui";
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
    throw new Error("현재 월을 확인하지 못했습니다.");
  }

  return `${year}-${month}`;
}

function normalizeMonth(
  value: string | undefined,
  fallbackMonth: string,
) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return fallbackMonth;
  }

  const [year, month] = value.split("-").map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return fallbackMonth;
  }

  return `${String(year).padStart(4, "0")}-${String(
    month,
  ).padStart(2, "0")}`;
}

function shiftMonth(
  monthValue: string,
  offset: number,
) {
  const [year, month] = monthValue.split("-").map(Number);
  const shifted = new Date(
    Date.UTC(year, month - 1 + offset, 1),
  );

  return `${shifted.getUTCFullYear()}-${String(
    shifted.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${year}년 ${month}월`;
}

function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

type SettlementsPageProps = {
  searchParams: Promise<{
    month?: string;
  }>;
};

export default async function SettlementsPage({
  searchParams,
}: SettlementsPageProps) {
  const currentMonth = getCurrentMonthInKorea();
  const params = await searchParams;
  const month = normalizeMonth(
    params.month,
    currentMonth,
  );
  const previousMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const startDate = `${month}-01`;
  const nextMonthStart = `${nextMonth}-01`;

  const { supabase, householdId } =
    await requireCurrentHousehold();

  const [accountsResult, transactionsResult] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, is_living_account")
        .eq("household_id", householdId)
        .order("name", { ascending: true }),

      supabase
        .from("transactions")
        .select(
          "id, effective_date, transaction_type, name, amount, status, account_id, fund_purpose, living_allocated_amount, settlement_completed_at",
        )
        .eq("household_id", householdId)
        .eq("status", "confirmed")
        .in("transaction_type", ["income", "expense"])
        .gte("effective_date", startDate)
        .lt("effective_date", nextMonthStart)
        .order("effective_date", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  if (accountsResult.error) {
    console.error(
      "Failed to load settlement accounts:",
      accountsResult.error,
    );

    throw new Error("계좌 정보를 불러오지 못했습니다.");
  }

  if (transactionsResult.error) {
    console.error(
      "Failed to load settlement transactions:",
      transactionsResult.error,
    );

    throw new Error("정산 거래를 불러오지 못했습니다.");
  }

  const result = buildSettlementItems(
    transactionsResult.data ?? [],
    accountsResult.data ?? [],
  );

  const pendingItems = result.items.filter(
    (item) => item.completedAt === null,
  );

  const receivableAmount = pendingItems
    .filter(
      (item) =>
        isSettlementIntoLivingAccount(item.direction),
    )
    .reduce((sum, item) => sum + item.amount, 0);

  const payableAmount = pendingItems
    .filter(
      (item) =>
        isSettlementOutOfLivingAccount(item.direction),
    )
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            생활비 정산
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            확정 거래를 기준으로 생활비 계좌·개인 계좌·투자 자금 사이에 옮겨야 할 금액을 정리합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/settlements?month=${previousMonth}`}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"
          >
            ←
          </Link>

          <span className="min-w-28 text-center text-sm font-semibold">
            {monthLabel(month)}
          </span>

          <Link
            href={`/settlements?month=${nextMonth}`}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"
          >
            →
          </Link>
        </div>
      </div>

      {!result.livingAccount ? (
        <Card title="생활비 계좌 설정 필요">
          <div className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            생활비 정산을 계산하려면 먼저 생활비 계좌를 하나 지정해주세요.
          </div>

          <Link
            href="/settings/accounts"
            className="mt-4 inline-flex rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white"
          >
            카드/계좌 설정으로 이동
          </Link>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card
              title="생활비 계좌로 받을 금액"
              value={won(receivableAmount)}
              sub="개인 계좌·투자 자금에서 생활비 계좌로 옮길 금액"
            />

            <Card
              title="생활비 계좌에서 보낼 금액"
              value={won(payableAmount)}
              sub="개인 계좌 보전·투자 자금 이동으로 보낼 금액"
            />

            <Card
              title="미정산 거래"
              value={`${pendingItems.length}건`}
              sub={`생활비 계좌 · ${result.livingAccount.name}`}
            />
          </div>

          <Card title={`${monthLabel(month)} 정산 내역`}>
            <SettlementManager items={result.items} />
          </Card>
        </>
      )}
    </div>
  );
}
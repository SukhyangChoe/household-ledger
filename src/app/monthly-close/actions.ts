"use server";

import { revalidatePath } from "next/cache";

import {
  buildMonthlySnapshotValues,
  monthEndDate,
} from "@/domain/monthly-close";
import { calculateLivingAccountLedgerBalance } from "@/domain/reconciliation";
import { buildSettlementItems } from "@/domain/settlement";
import { requireCurrentHousehold } from "@/lib/household/current";

export type MonthlyCloseActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function errorState(
  message: string,
): MonthlyCloseActionState {
  return {
    status: "error",
    message,
  };
}

function successState(
  message: string,
): MonthlyCloseActionState {
  return {
    status: "success",
    message,
  };
}

function parseMonth(value: string) {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(
      value,
    )
  ) {
    return null;
  }

  return value;
}

function getCurrentMonthInKorea() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
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
  const [year, month] =
    monthValue
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

function revalidateMonthlyClosePaths() {
  revalidatePath(
    "/monthly-close",
  );
  revalidatePath("/ledger");
  revalidatePath(
    "/settlements",
  );
  revalidatePath(
    "/reconciliation",
  );
  revalidatePath(
    "/recurring",
  );
  revalidatePath("/");
}

export async function closeMonth(
  _previousState: MonthlyCloseActionState,
  formData: FormData,
): Promise<MonthlyCloseActionState> {
  const month = parseMonth(
    String(
      formData.get("month") ??
        "",
    ).trim(),
  );

  if (!month) {
    return errorState(
      "마감할 월을 확인하지 못했습니다.",
    );
  }

  const currentMonth =
    getCurrentMonthInKorea();

  if (month >= currentMonth) {
    return errorState(
      "현재 월은 다음 달부터 마감할 수 있습니다.",
    );
  }

  const snapshotMonth =
    `${month}-01`;
  const nextMonthStart =
    `${shiftMonth(month, 1)}-01`;
  const monthEnd =
    monthEndDate(month);

  const {
    supabase,
    householdId,
  } =
    await requireCurrentHousehold();

  const {
    data: existingSnapshot,
    error: snapshotError,
  } = await supabase
    .from("monthly_snapshots")
    .select("id")
    .eq(
      "household_id",
      householdId,
    )
    .eq(
      "snapshot_month",
      snapshotMonth,
    )
    .maybeSingle();

  if (snapshotError) {
    console.error(
      "Failed to check monthly snapshot:",
      snapshotError,
    );

    return errorState(
      "월 마감 상태를 확인하지 못했습니다.",
    );
  }

  if (existingSnapshot) {
    return errorState(
      "이미 마감된 월입니다.",
    );
  }

  const {
    error: generationError,
  } = await supabase.rpc(
    "generate_recurring_transactions",
    {
      p_household_id:
        householdId,
      p_target_month:
        snapshotMonth,
    },
  );

  if (generationError) {
    console.error(
      "Failed to generate recurring transactions before monthly close:",
      generationError,
    );

    return errorState(
      "정기 거래를 확인하지 못해 월 마감을 진행할 수 없습니다.",
    );
  }

  const {
    data: accounts,
    error: accountsError,
  } = await supabase
    .from("accounts")
    .select(
      "id, name, is_living_account",
    )
    .eq(
      "household_id",
      householdId,
    );

  if (accountsError) {
    console.error(
      "Failed to load monthly close accounts:",
      accountsError,
    );

    return errorState(
      "계좌 정보를 불러오지 못했습니다.",
    );
  }

  const livingAccount =
    (accounts ?? []).find(
      (account) =>
        account.is_living_account,
    ) ?? null;

  if (!livingAccount) {
    return errorState(
      "생활비 계좌를 먼저 지정해주세요.",
    );
  }

  const [
    monthTransactionsResult,
    baselineResult,
    ledgerTransactionsResult,
  ] = await Promise.all([
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
        snapshotMonth,
      )
      .lt(
        "effective_date",
        nextMonthStart,
      ),

    supabase
      .from(
        "account_reconciliations",
      )
      .select(
        "checked_date, actual_balance",
      )
      .eq(
        "household_id",
        householdId,
      )
      .eq(
        "account_id",
        livingAccount.id,
      )
      .lte(
        "checked_date",
        monthEnd,
      )
      .order(
        "checked_date",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle(),

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
      )
      .lte(
        "effective_date",
        monthEnd,
      ),
  ]);

  const firstError =
    monthTransactionsResult.error ??
    baselineResult.error ??
    ledgerTransactionsResult.error;

  if (firstError) {
    console.error(
      "Failed to load monthly close inputs:",
      firstError,
    );

    return errorState(
      "월 마감에 필요한 데이터를 불러오지 못했습니다.",
    );
  }

  const monthTransactions =
    monthTransactionsResult.data ??
    [];

  const plannedCount =
    monthTransactions.filter(
      (transaction) =>
        transaction.status ===
        "planned",
    ).length;

  if (plannedCount > 0) {
    return errorState(
      `예정 거래 ${plannedCount}건이 남아 있습니다. 확정 또는 취소한 뒤 마감해주세요.`,
    );
  }

  const baseline =
    baselineResult.data;

  if (!baseline) {
    return errorState(
      `${monthEnd} 이전에 저장된 생활비 계좌 잔액 대조 기준점이 필요합니다.`,
    );
  }

  const livingAccountLedgerBalance =
    calculateLivingAccountLedgerBalance(
      {
        baselineActualBalance:
          baseline.actual_balance,
        baselineDate:
          baseline.checked_date,
        targetDate: monthEnd,
        livingAccountId:
          livingAccount.id,
        transactions:
          ledgerTransactionsResult.data ??
          [],
      },
    );

  const settlementResult =
    buildSettlementItems(
      monthTransactions,
      accounts ?? [],
    );

  const unsettledCount =
    settlementResult.items.filter(
      (item) =>
        item.completedAt ===
        null,
    ).length;

  const snapshotValues =
    buildMonthlySnapshotValues(
      {
        transactions:
          monthTransactions,
        livingAccountLedgerBalance,
        livingAccountActualBalance:
          baseline.checked_date ===
          monthEnd
            ? baseline.actual_balance
            : null,
        unsettledCount,
      },
    );

  const {
    error: insertError,
  } = await supabase
    .from("monthly_snapshots")
    .insert({
      household_id:
        householdId,
      snapshot_month:
        snapshotMonth,
      ...snapshotValues,
    });

  if (insertError) {
    console.error(
      "Failed to close month:",
      insertError,
    );

    return errorState(
      "월 마감을 저장하지 못했습니다.",
    );
  }

  revalidateMonthlyClosePaths();

  return successState(
    `${month} 월 마감을 완료했습니다. 해당 월의 거래 재무값은 마감 취소 전까지 잠깁니다.`,
  );
}

export async function reopenMonth(
  _previousState: MonthlyCloseActionState,
  formData: FormData,
): Promise<MonthlyCloseActionState> {
  const month = parseMonth(
    String(
      formData.get("month") ??
        "",
    ).trim(),
  );

  if (!month) {
    return errorState(
      "마감 취소할 월을 확인하지 못했습니다.",
    );
  }

  const snapshotMonth =
    `${month}-01`;

  const {
    supabase,
    householdId,
  } =
    await requireCurrentHousehold();

  const {
    data: laterSnapshot,
    error: laterError,
  } = await supabase
    .from("monthly_snapshots")
    .select(
      "snapshot_month",
    )
    .eq(
      "household_id",
      householdId,
    )
    .gt(
      "snapshot_month",
      snapshotMonth,
    )
    .order(
      "snapshot_month",
      {
        ascending: true,
      },
    )
    .limit(1)
    .maybeSingle();

  if (laterError) {
    console.error(
      "Failed to check later snapshot:",
      laterError,
    );

    return errorState(
      "이후 월의 마감 상태를 확인하지 못했습니다.",
    );
  }

  if (laterSnapshot) {
    return errorState(
      `${laterSnapshot.snapshot_month.slice(
        0,
        7,
      )} 이후 월이 이미 마감되어 있습니다. 가장 최근 마감 월부터 역순으로 취소해주세요.`,
    );
  }

  const {
    data: deleted,
    error: deleteError,
  } = await supabase
    .from("monthly_snapshots")
    .delete()
    .eq(
      "household_id",
      householdId,
    )
    .eq(
      "snapshot_month",
      snapshotMonth,
    )
    .select("id")
    .maybeSingle();

  if (deleteError) {
    console.error(
      "Failed to reopen month:",
      deleteError,
    );

    return errorState(
      "월 마감을 취소하지 못했습니다.",
    );
  }

  if (!deleted) {
    return errorState(
      "마감된 월을 찾지 못했습니다.",
    );
  }

  revalidateMonthlyClosePaths();

  return successState(
    `${month} 월 마감을 취소했습니다. 해당 월 거래를 다시 수정할 수 있습니다.`,
  );
}

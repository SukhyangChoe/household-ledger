"use server";

import { revalidatePath } from "next/cache";

import {
  calculateLivingAccountLedgerBalance,
  reconciliationDifference,
} from "@/domain/reconciliation";
import { requireCurrentHousehold } from "@/lib/household/current";

export type ReconciliationActionState = {
  status: "idle" | "success" | "error";
  message: string;
  resetKey: string;
};

function errorState(
  previousState: ReconciliationActionState,
  message: string,
): ReconciliationActionState {
  return {
    status: "error",
    message,
    resetKey: previousState.resetKey,
  };
}

function successState(
  message: string,
): ReconciliationActionState {
  return {
    status: "success",
    message,
    resetKey: crypto.randomUUID(),
  };
}

function getText(
  formData: FormData,
  key: string,
) {
  return String(
    formData.get(key) ?? "",
  ).trim();
}

function parseSignedInteger(
  value: string,
) {
  const normalized =
    value.replace(/[\s,]/g, "");

  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
}

function parseDate(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return null;
  }

  const parsed = new Date(
    `${value}T00:00:00Z`,
  );

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed
      .toISOString()
      .slice(0, 10) !== value
  ) {
    return null;
  }

  return value;
}

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

function signedWon(value: number) {
  if (value === 0) {
    return "0원";
  }

  return `${
    value > 0 ? "+" : ""
  }${won(value)}`;
}

export async function saveReconciliation(
  previousState: ReconciliationActionState,
  formData: FormData,
): Promise<ReconciliationActionState> {
  const checkedDate = parseDate(
    getText(
      formData,
      "checkedDate",
    ),
  );
  const actualBalance =
    parseSignedInteger(
      getText(
        formData,
        "actualBalance",
      ),
    );
  const memo = getText(
    formData,
    "memo",
  );

  if (!checkedDate) {
    return errorState(
      previousState,
      "대조 날짜를 확인해주세요.",
    );
  }

  if (actualBalance === null) {
    return errorState(
      previousState,
      "실제 잔액을 원 단위 정수로 입력해주세요.",
    );
  }

  if (memo.length > 300) {
    return errorState(
      previousState,
      "메모는 300자 이내로 입력해주세요.",
    );
  }

  const today = getKoreaToday();

  if (checkedDate > today) {
    return errorState(
      previousState,
      "미래 날짜로는 잔액 대조를 저장할 수 없습니다.",
    );
  }

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

  if (
    livingAccountError ||
    !livingAccount
  ) {
    console.error(
      "Failed to load living account:",
      livingAccountError,
    );

    return errorState(
      previousState,
      "생활비 계좌를 먼저 지정해주세요.",
    );
  }

  const {
    data: reconciliations,
    error:
      reconciliationsError,
  } = await supabase
    .from(
      "account_reconciliations",
    )
    .select(
      "id, checked_date, actual_balance, ledger_balance",
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
    );

  if (reconciliationsError) {
    console.error(
      "Failed to load reconciliation history:",
      reconciliationsError,
    );

    return errorState(
      previousState,
      "기존 잔액 대조 이력을 확인하지 못했습니다.",
    );
  }

  const history =
    reconciliations ?? [];
  const latest =
    history[0] ?? null;

  if (
    latest &&
    checkedDate <
      latest.checked_date
  ) {
    return errorState(
      previousState,
      `최근 대조일 ${latest.checked_date}보다 이전 날짜에는 새 대조를 저장할 수 없습니다.`,
    );
  }

  const previous =
    history.find(
      (item) =>
        item.checked_date <
        checkedDate,
    ) ?? null;

  let ledgerBalance =
    actualBalance;

  if (previous) {
    const {
      data: transactions,
      error:
        transactionsError,
    } = await supabase
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
      );

    if (transactionsError) {
      console.error(
        "Failed to load transactions for reconciliation:",
        transactionsError,
      );

      return errorState(
        previousState,
        "장부 잔액 계산에 필요한 거래를 불러오지 못했습니다.",
      );
    }

    ledgerBalance =
      calculateLivingAccountLedgerBalance(
        {
          baselineActualBalance:
            previous.actual_balance,
          baselineDate:
            previous.checked_date,
          targetDate:
            checkedDate,
          livingAccountId:
            livingAccount.id,
          transactions:
            transactions ?? [],
        },
      );
  }

  const {
    error: upsertError,
  } = await supabase
    .from(
      "account_reconciliations",
    )
    .upsert(
      {
        household_id:
          householdId,
        account_id:
          livingAccount.id,
        checked_date:
          checkedDate,
        actual_balance:
          actualBalance,
        ledger_balance:
          ledgerBalance,
        memo:
          memo || null,
      },
      {
        onConflict:
          "account_id,checked_date",
      },
    );

  if (upsertError) {
    console.error(
      "Failed to save reconciliation:",
      upsertError,
    );

    return errorState(
      previousState,
      "잔액 대조를 저장하지 못했습니다.",
    );
  }

  revalidatePath(
    "/reconciliation",
  );
  revalidatePath("/");

  if (!previous) {
    return successState(
      `첫 기준 잔액 ${won(
        actualBalance,
      )}을 저장했습니다. 이 날짜 이후부터 프로그램 장부 잔액을 추적합니다.`,
    );
  }

  const difference =
    reconciliationDifference(
      actualBalance,
      ledgerBalance,
    );

  if (difference === 0) {
    return successState(
      `잔액 대조를 저장했습니다. 프로그램 장부 잔액과 실제 잔액이 ${won(
        actualBalance,
      )}으로 일치합니다.`,
    );
  }

  return successState(
    `잔액 대조를 저장했습니다. 실제 잔액과 프로그램 장부 잔액의 차이는 ${signedWon(
      difference,
    )}입니다.`,
  );
}

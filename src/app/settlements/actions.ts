"use server";

import { revalidatePath } from "next/cache";

import { buildSettlementItems } from "@/domain/settlement";
import { requireCurrentHousehold } from "@/lib/household/current";

export type SettlementActionState = {
  status: "idle" | "success" | "error";
  message: string;
  resetKey: string;
};

function errorState(
  previousState: SettlementActionState,
  message: string,
): SettlementActionState {
  return {
    status: "error",
    message,
    resetKey: previousState.resetKey,
  };
}

function successState(
  message: string,
): SettlementActionState {
  return {
    status: "success",
    message,
    resetKey: crypto.randomUUID(),
  };
}

function parseBoolean(value: string) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function getSelectedTransactionIds(
  formData: FormData,
) {
  return [
    ...new Set(
      formData
        .getAll("transactionId")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];
}

export async function changeSettlementStatus(
  previousState: SettlementActionState,
  formData: FormData,
): Promise<SettlementActionState> {
  const transactionIds =
    getSelectedTransactionIds(formData);
  const nextCompleted = parseBoolean(
    String(formData.get("nextCompleted") ?? ""),
  );

  if (transactionIds.length === 0) {
    return errorState(
      previousState,
      "처리할 거래를 하나 이상 선택해주세요.",
    );
  }

  if (nextCompleted === null) {
    return errorState(
      previousState,
      "정산 상태를 확인하지 못했습니다.",
    );
  }

  const { supabase, householdId } =
    await requireCurrentHousehold();

  const [accountsResult, transactionsResult] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, is_living_account")
        .eq("household_id", householdId),

      supabase
        .from("transactions")
        .select(
          "id, effective_date, transaction_type, name, amount, status, account_id, fund_purpose, living_allocated_amount, settlement_completed_at",
        )
        .eq("household_id", householdId)
        .in("id", transactionIds),
    ]);

  if (accountsResult.error) {
    console.error(
      "Failed to load settlement accounts:",
      accountsResult.error,
    );

    return errorState(
      previousState,
      "계좌 정보를 확인하지 못했습니다.",
    );
  }

  if (transactionsResult.error) {
    console.error(
      "Failed to load settlement transactions:",
      transactionsResult.error,
    );

    return errorState(
      previousState,
      "정산 거래를 확인하지 못했습니다.",
    );
  }

  const settlementResult = buildSettlementItems(
    transactionsResult.data ?? [],
    accountsResult.data ?? [],
  );

  if (!settlementResult.livingAccount) {
    return errorState(
      previousState,
      "생활비 계좌를 먼저 지정해주세요.",
    );
  }

  const validIds = new Set(
    settlementResult.items
      .filter((item) =>
        nextCompleted
          ? item.completedAt === null
          : item.completedAt !== null,
      )
      .map((item) => item.transactionId),
  );

  if (
    transactionIds.some(
      (transactionId) => !validIds.has(transactionId),
    )
  ) {
    return errorState(
      previousState,
      nextCompleted
        ? "선택한 거래 중 현재 정산 완료 처리할 수 없는 항목이 있습니다. 화면을 새로고침한 뒤 다시 확인해주세요."
        : "선택한 거래 중 현재 정산 완료를 취소할 수 없는 항목이 있습니다. 화면을 새로고침한 뒤 다시 확인해주세요.",
    );
  }

  let updateQuery = supabase
    .from("transactions")
    .update({
      settlement_completed_at: nextCompleted
        ? new Date().toISOString()
        : null,
    })
    .eq("household_id", householdId)
    .eq("status", "confirmed")
    .in("id", transactionIds);

  updateQuery = nextCompleted
    ? updateQuery.is("settlement_completed_at", null)
    : updateQuery.not(
        "settlement_completed_at",
        "is",
        null,
      );

  const { data, error } = await updateQuery.select("id");

  if (error) {
    console.error(
      "Failed to change settlement status:",
      error,
    );

    return errorState(
      previousState,
      "정산 상태를 변경하지 못했습니다.",
    );
  }

  if ((data ?? []).length !== transactionIds.length) {
    return errorState(
      previousState,
      "일부 거래의 상태가 이미 변경되었습니다. 화면을 새로고침한 뒤 다시 확인해주세요.",
    );
  }

  revalidatePath("/settlements");
  revalidatePath("/");

  return successState(
    nextCompleted
      ? `${transactionIds.length}건의 거래를 정산 완료 처리했습니다.`
      : `${transactionIds.length}건의 정산 완료를 취소했습니다.`,
  );
}
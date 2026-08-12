"use server";

import { revalidatePath } from "next/cache";

import {
  updateTransaction,
  type TransactionActionState,
} from "@/app/ledger/actions";
import { requireCurrentHousehold } from "@/lib/household/current";
import type { Database } from "@/types/database.types";

type ExpenseSummaryGroup =
  Database["public"]["Enums"]["expense_summary_group"];

export type SummaryGroupActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseExpenseSummaryGroup(
  value: string,
): ExpenseSummaryGroup | null {
  if (
    value === "monthly" ||
    value === "annual" ||
    value === "variable" ||
    value === "repayment_saving"
  ) {
    return value;
  }

  return null;
}

function errorState(message: string): SummaryGroupActionState {
  return {
    status: "error",
    message,
  };
}

export async function updateExpenseSummaryGroup(
  _previousState: SummaryGroupActionState,
  formData: FormData,
): Promise<SummaryGroupActionState> {
  const transactionId = getText(
    formData,
    "transactionId",
  );
  const expenseSummaryGroup =
    parseExpenseSummaryGroup(
      getText(
        formData,
        "expenseSummaryGroup",
      ),
    );

  if (!transactionId) {
    return errorState(
      "수정할 거래를 확인하지 못했습니다.",
    );
  }

  if (!expenseSummaryGroup) {
    return errorState(
      "월별 가계부 표시 분류를 선택해주세요.",
    );
  }

  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { data: transaction, error: loadError } =
    await supabase
      .from("transactions")
      .select(
        "id, transaction_type, status, settlement_completed_at",
      )
      .eq("id", transactionId)
      .eq("household_id", householdId)
      .maybeSingle();

  if (loadError || !transaction) {
    return errorState(
      "수정할 거래를 찾지 못했습니다.",
    );
  }

  if (transaction.transaction_type !== "expense") {
    return errorState(
      "지출 거래만 표시 분류를 변경할 수 있습니다.",
    );
  }

  if (transaction.status === "cancelled") {
    return errorState(
      "취소 처리된 거래는 수정할 수 없습니다.",
    );
  }

  if (transaction.settlement_completed_at) {
    return errorState(
      "정산이 완료된 거래는 수정할 수 없습니다.",
    );
  }

  const { data, error } = await supabase
    .from("transactions")
    .update({
      expense_summary_group_snapshot:
        expenseSummaryGroup,
    })
    .eq("id", transactionId)
    .eq("household_id", householdId)
    .select("id, expense_summary_group_snapshot")
    .maybeSingle();

  if (error) {
    console.error(
      "Failed to update expense summary group:",
      error,
    );

    if (
      error.message.includes("MONTH_CLOSED") ||
      error.message.includes("CLOSED_MONTH")
    ) {
      return errorState(
        "마감된 달의 거래는 수정할 수 없습니다.",
      );
    }

    return errorState(
      "월별 가계부 표시 분류를 변경하지 못했습니다.",
    );
  }

  if (!data) {
    return errorState(
      "수정할 거래를 찾지 못했습니다.",
    );
  }

  if (
    data.expense_summary_group_snapshot !==
    expenseSummaryGroup
  ) {
    console.error(
      "Expense summary group was overwritten:",
      {
        requested: expenseSummaryGroup,
        saved:
          data.expense_summary_group_snapshot,
      },
    );

    return errorState(
      "표시 분류가 DB에서 다시 덮어써졌습니다. 최신 migration 적용 여부를 확인해주세요.",
    );
  }

  revalidatePath("/ledger");
  revalidatePath("/");

  return {
    status: "success",
    message: "저장됨",
  };
}


export async function updateTransactionWithSummaryGroup(
  previousState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const transactionResult = await updateTransaction(
    previousState,
    formData,
  );

  if (transactionResult.status !== "success") {
    return transactionResult;
  }

  const expenseSummaryGroup = getText(
    formData,
    "expenseSummaryGroup",
  );

  if (!expenseSummaryGroup) {
    return transactionResult;
  }

  const summaryGroupResult =
    await updateExpenseSummaryGroup(
      {
        status: "idle",
        message: "",
      },
      formData,
    );

  if (summaryGroupResult.status === "error") {
    return {
      status: "error",
      message:
        `거래 정보는 저장했지만 표시 분류는 저장하지 못했습니다. ${summaryGroupResult.message}`,
      resetKey: transactionResult.resetKey,
    };
  }

  return transactionResult;
}
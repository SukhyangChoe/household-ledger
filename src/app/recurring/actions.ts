"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentHousehold } from "@/lib/household/current";
import type { Database } from "@/types/database.types";

type RecurringRuleInsert =
  Database["public"]["Tables"]["recurring_rules"]["Insert"];

type RecurringTransactionType =
  | "income"
  | "expense";

type PaymentMethod =
  | "account"
  | "card";

type OwnerType =
  Database["public"]["Enums"]["owner_type"];

type FundPurpose =
  Database["public"]["Enums"]["fund_purpose"];

type ExpenseNature =
  Database["public"]["Enums"]["expense_nature"];

type HouseholdContext = Awaited<
  ReturnType<typeof requireCurrentHousehold>
>;

type SupabaseClient =
  HouseholdContext["supabase"];

export type RecurringActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

type BuildValuesResult =
  | {
      ok: true;
      values: Omit<
        RecurringRuleInsert,
        "household_id"
      >;
    }
  | {
      ok: false;
      message: string;
    };

function getText(
  formData: FormData,
  key: string,
) {
  return String(
    formData.get(key) ?? "",
  ).trim();
}

function parseTransactionType(
  value: string,
): RecurringTransactionType | null {
  if (
    value === "income" ||
    value === "expense"
  ) {
    return value;
  }

  return null;
}

function parsePaymentMethod(
  value: string,
): PaymentMethod | null {
  if (
    value === "account" ||
    value === "card"
  ) {
    return value;
  }

  return null;
}

function parseOwnerType(
  value: string,
): OwnerType | null {
  if (
    value === "wife" ||
    value === "husband" ||
    value === "joint"
  ) {
    return value;
  }

  return null;
}

function parseFundPurpose(
  value: string,
): FundPurpose | null {
  if (
    value === "living" ||
    value === "investment"
  ) {
    return value;
  }

  return null;
}

function parseExpenseNature(
  value: string,
): ExpenseNature | null {
  if (
    value === "fixed" ||
    value === "variable" ||
    value === "irregular"
  ) {
    return value;
  }

  return null;
}

function parsePositiveInteger(
  value: string,
) {
  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function parsePaymentDay(
  value: string,
) {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > 31
  ) {
    return null;
  }

  return parsed;
}

function parseMonth(
  value: string,
) {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(
      value,
    )
  ) {
    return null;
  }

  return `${value}-01`;
}

function errorState(
  message: string,
): RecurringActionState {
  return {
    status: "error",
    message,
  };
}

function successState(
  message: string,
): RecurringActionState {
  return {
    status: "success",
    message,
  };
}

function revalidateRecurringPaths() {
  revalidatePath("/recurring");
  revalidatePath("/ledger");
  revalidatePath("/");
}

function getDatabaseErrorMessage(error: {
  code?: string;
  message: string;
}) {
  if (error.code === "23503") {
    return "연결된 계좌·카드·카테고리 또는 반영률을 확인해주세요.";
  }

  if (error.code === "23514") {
    return "정기 항목 설정값의 조합을 확인해주세요.";
  }

  return "정기 항목을 저장하지 못했습니다.";
}

async function buildRecurringValues(
  formData: FormData,
  supabase: SupabaseClient,
  householdId: string,
): Promise<BuildValuesResult> {
  const name = getText(formData, "name");
  const transactionType =
    parseTransactionType(
      getText(
        formData,
        "transactionType",
      ),
    );
  const paymentMethod =
    parsePaymentMethod(
      getText(
        formData,
        "paymentMethod",
      ),
    );
  const amount = parsePositiveInteger(
    getText(formData, "amount"),
  );
  const startMonth = parseMonth(
    getText(formData, "startMonth"),
  );
  const endMonthText = getText(
    formData,
    "endMonth",
  );
  const endMonth = endMonthText
    ? parseMonth(endMonthText)
    : null;
  const categoryId = getText(
    formData,
    "categoryId",
  );
  const ownerType = parseOwnerType(
    getText(formData, "ownerType"),
  );
  const memo = getText(
    formData,
    "memo",
  );

  if (!name) {
    return {
      ok: false,
      message:
        "정기 항목명을 입력해주세요.",
    };
  }

  if (name.length > 80) {
    return {
      ok: false,
      message:
        "정기 항목명은 80자 이내로 입력해주세요.",
    };
  }

  if (!transactionType) {
    return {
      ok: false,
      message:
        "수입 또는 지출을 선택해주세요.",
    };
  }

  if (!paymentMethod) {
    return {
      ok: false,
      message:
        "계좌 또는 카드를 선택해주세요.",
    };
  }

  if (
    transactionType === "income" &&
    paymentMethod !== "account"
  ) {
    return {
      ok: false,
      message:
        "정기 수입은 입금 계좌를 연결해주세요.",
    };
  }

  if (!amount) {
    return {
      ok: false,
      message:
        "금액은 1원 이상의 정수로 입력해주세요.",
    };
  }

  if (!startMonth) {
    return {
      ok: false,
      message:
        "시작 월을 확인해주세요.",
    };
  }

  if (
    endMonthText &&
    !endMonth
  ) {
    return {
      ok: false,
      message:
        "종료 월을 확인해주세요.",
    };
  }

  if (
    endMonth &&
    endMonth < startMonth
  ) {
    return {
      ok: false,
      message:
        "종료 월은 시작 월보다 빠를 수 없습니다.",
    };
  }

  if (!categoryId) {
    return {
      ok: false,
      message:
        "카테고리를 선택해주세요.",
    };
  }

  if (!ownerType) {
    return {
      ok: false,
      message:
        "거래 소유자를 선택해주세요.",
    };
  }

  if (memo.length > 300) {
    return {
      ok: false,
      message:
        "메모는 300자 이내로 입력해주세요.",
    };
  }

  const {
    data: category,
    error: categoryError,
  } = await supabase
    .from("categories")
    .select(
      "id, transaction_type, rate_rule_id",
    )
    .eq("household_id", householdId)
    .eq("id", categoryId)
    .maybeSingle();

  if (
    categoryError ||
    !category
  ) {
    return {
      ok: false,
      message:
        "선택한 카테고리를 확인하지 못했습니다.",
    };
  }

  if (
    category.transaction_type !==
    transactionType
  ) {
    return {
      ok: false,
      message:
        "거래 유형에 맞는 카테고리를 선택해주세요.",
    };
  }

  let accountId: string | null =
    null;
  let cardId: string | null =
    null;
  let paymentDay: number | null =
    null;

  if (paymentMethod === "account") {
    accountId = getText(
      formData,
      "accountId",
    );

    if (!accountId) {
      return {
        ok: false,
        message:
          transactionType === "income"
            ? "입금 계좌를 선택해주세요."
            : "출금 계좌를 선택해주세요.",
      };
    }

    const {
      data: account,
      error: accountError,
    } = await supabase
      .from("accounts")
      .select("id")
      .eq(
        "household_id",
        householdId,
      )
      .eq("id", accountId)
      .maybeSingle();

    if (
      accountError ||
      !account
    ) {
      return {
        ok: false,
        message:
          "선택한 계좌를 확인하지 못했습니다.",
      };
    }

    paymentDay = parsePaymentDay(
      getText(
        formData,
        "paymentDay",
      ),
    );

    if (!paymentDay) {
      return {
        ok: false,
        message:
          "매월 반영일을 1일부터 31일 사이로 입력해주세요.",
      };
    }
  } else {
    cardId = getText(
      formData,
      "cardId",
    );

    if (!cardId) {
      return {
        ok: false,
        message:
          "결제 카드를 선택해주세요.",
      };
    }

    const {
      data: card,
      error: cardError,
    } = await supabase
      .from("cards")
      .select("id, payment_day")
      .eq(
        "household_id",
        householdId,
      )
      .eq("id", cardId)
      .maybeSingle();

    if (
      cardError ||
      !card
    ) {
      return {
        ok: false,
        message:
          "선택한 카드를 확인하지 못했습니다.",
      };
    }

    paymentDay =
      card.payment_day;
  }

  if (paymentDay === null) {
    return {
      ok: false,
      message:
        "매월 반영일을 확인하지 못했습니다.",
    };
  }

  let rateRuleId: string | null =
    null;
  let fundPurpose:
    | FundPurpose
    | null = null;
  let expenseNature:
    | ExpenseNature
    | null = null;

  if (
    transactionType === "income"
  ) {
    rateRuleId =
      getText(
        formData,
        "rateRuleId",
      ) ||
      category.rate_rule_id;

    if (!rateRuleId) {
      return {
        ok: false,
        message:
          "수입에 적용할 생활비 반영률을 선택해주세요.",
      };
    }

    const {
      data: rateRule,
      error: rateRuleError,
    } = await supabase
      .from("rate_rules")
      .select("id")
      .eq(
        "household_id",
        householdId,
      )
      .eq("id", rateRuleId)
      .maybeSingle();

    if (
      rateRuleError ||
      !rateRule
    ) {
      return {
        ok: false,
        message:
          "선택한 생활비 반영률을 확인하지 못했습니다.",
      };
    }
  } else {
    fundPurpose =
      parseFundPurpose(
        getText(
          formData,
          "fundPurpose",
        ),
      );
    expenseNature =
      parseExpenseNature(
        getText(
          formData,
          "expenseNature",
        ),
      );

    if (!fundPurpose) {
      return {
        ok: false,
        message:
          "지출 목적을 선택해주세요.",
      };
    }

    if (!expenseNature) {
      return {
        ok: false,
        message:
          "지출 성격을 선택해주세요.",
      };
    }
  }

  return {
    ok: true,
    values: {
      name,
      transaction_type:
        transactionType,
      amount,
      start_month: startMonth,
      end_month: endMonth,
      payment_day: paymentDay,
      account_id: accountId,
      card_id: cardId,
      category_id: categoryId,
      rate_rule_id: rateRuleId,
      fund_purpose: fundPurpose,
      expense_nature:
        expenseNature,
      owner_type: ownerType,
      show_occurrence_progress:
        Boolean(endMonth) &&
        formData.get(
          "showOccurrenceProgress",
        ) === "on",
      memo: memo || null,
    },
  };
}

export async function createRecurringRule(
  _previousState: RecurringActionState,
  formData: FormData,
): Promise<RecurringActionState> {
  const {
    supabase,
    householdId,
  } = await requireCurrentHousehold();

  const result =
    await buildRecurringValues(
      formData,
      supabase,
      householdId,
    );

  if (result.ok === false) {
    return errorState(
      result.message,
    );
  }

  const { error } = await supabase
    .from("recurring_rules")
    .insert({
      household_id: householdId,
      ...result.values,
      is_active: true,
    });

  if (error) {
    console.error(
      "Failed to create recurring rule:",
      error,
    );

    return errorState(
      getDatabaseErrorMessage(error),
    );
  }

  revalidateRecurringPaths();

  return successState(
    "정기 항목을 등록했습니다.",
  );
}

export async function updateRecurringRule(
  _previousState: RecurringActionState,
  formData: FormData,
): Promise<RecurringActionState> {
  const recurringRuleId = getText(
    formData,
    "recurringRuleId",
  );

  if (!recurringRuleId) {
    return errorState(
      "수정할 정기 항목을 확인하지 못했습니다.",
    );
  }

  const {
    supabase,
    householdId,
  } = await requireCurrentHousehold();

  const result =
    await buildRecurringValues(
      formData,
      supabase,
      householdId,
    );

  if (result.ok === false) {
    return errorState(
      result.message,
    );
  }

  const { error } = await supabase
    .from("recurring_rules")
    .update(result.values)
    .eq(
      "household_id",
      householdId,
    )
    .eq("id", recurringRuleId);

  if (error) {
    console.error(
      "Failed to update recurring rule:",
      error,
    );

    return errorState(
      getDatabaseErrorMessage(error),
    );
  }

  revalidateRecurringPaths();

  return successState(
    "정기 항목을 수정했습니다. 이미 생성된 거래는 그대로 유지되고 다음 생성분부터 반영됩니다.",
  );
}

export async function toggleRecurringRuleActive(
  _previousState: RecurringActionState,
  formData: FormData,
): Promise<RecurringActionState> {
  const recurringRuleId = getText(
    formData,
    "recurringRuleId",
  );
  const nextActiveText = getText(
    formData,
    "nextActive",
  );

  if (!recurringRuleId) {
    return errorState(
      "처리할 정기 항목을 확인하지 못했습니다.",
    );
  }

  if (
    nextActiveText !== "true" &&
    nextActiveText !== "false"
  ) {
    return errorState(
      "변경할 활성 상태를 확인하지 못했습니다.",
    );
  }

  const nextActive =
    nextActiveText === "true";

  const {
    supabase,
    householdId,
  } = await requireCurrentHousehold();

  const { error } = await supabase
    .from("recurring_rules")
    .update({
      is_active: nextActive,
    })
    .eq(
      "household_id",
      householdId,
    )
    .eq("id", recurringRuleId);

  if (error) {
    console.error(
      "Failed to toggle recurring rule:",
      error,
    );

    return errorState(
      "정기 항목 상태를 변경하지 못했습니다.",
    );
  }

  revalidateRecurringPaths();

  return successState(
    nextActive
      ? "정기 항목을 다시 활성화했습니다."
      : "정기 항목을 비활성화했습니다.",
  );
}

export async function deleteRecurringRule(
  _previousState: RecurringActionState,
  formData: FormData,
): Promise<RecurringActionState> {
  const recurringRuleId = getText(
    formData,
    "recurringRuleId",
  );

  if (!recurringRuleId) {
    return errorState(
      "삭제할 정기 항목을 확인하지 못했습니다.",
    );
  }

  const { supabase } =
    await requireCurrentHousehold();

  const { error } = await supabase.rpc(
    "delete_unused_recurring_rule",
    {
      p_recurring_rule_id:
        recurringRuleId,
    },
  );

  if (error) {
    console.error(
      "Failed to delete recurring rule:",
      error,
    );

    if (
      error.message.includes(
        "RECURRING_RULE_IN_USE",
      )
    ) {
      return errorState(
        "이미 거래를 생성한 정기 항목은 삭제할 수 없습니다. 비활성화해주세요.",
      );
    }

    return errorState(
      "정기 항목을 삭제하지 못했습니다.",
    );
  }

  revalidateRecurringPaths();

  return successState(
    "정기 항목을 삭제했습니다.",
  );
}

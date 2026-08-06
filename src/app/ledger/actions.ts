"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentHousehold } from "@/lib/household/current";
import { calculateLivingAllocatedAmount } from "@/lib/transactions/calculation";
import type { Database } from "@/types/database.types";

type FundPurpose =
  Database["public"]["Enums"]["fund_purpose"];
type ExpenseNature =
  Database["public"]["Enums"]["expense_nature"];
type OwnerType =
  Database["public"]["Enums"]["owner_type"];
type TransactionInsert =
  Database["public"]["Tables"]["transactions"]["Insert"];
type TransactionUpdate =
  Database["public"]["Tables"]["transactions"]["Update"];

export type TransactionActionState = {
  status: "idle" | "success" | "error";
  message: string;
  resetKey: string;
};

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseAmount(value: string) {
  const normalized = value.replace(/[\s,]/g, "");

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return null;
  }

  return amount;
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return value;
}

function parseEditableStatus(
  value: string,
): "planned" | "confirmed" | null {
  if (value === "planned" || value === "confirmed") {
    return value;
  }

  return null;
}

function parseFundPurpose(
  value: string,
): FundPurpose | null {
  if (value === "living" || value === "investment") {
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

function parseOwnerType(value: string): OwnerType | null {
  if (
    value === "wife" ||
    value === "husband" ||
    value === "joint"
  ) {
    return value;
  }

  return null;
}

function errorState(
  previousState: TransactionActionState,
  message: string,
): TransactionActionState {
  return {
    status: "error",
    message,
    resetKey: previousState.resetKey,
  };
}

function successState(message: string): TransactionActionState {
  return {
    status: "success",
    message,
    resetKey: crypto.randomUUID(),
  };
}

function getDatabaseErrorMessage(error: {
  code?: string;
  message: string;
}) {
  if (
    error.message.includes("TRANSACTION_CATEGORY_INVALID") ||
    error.message.includes("TRANSACTION_CATEGORY_INACTIVE")
  ) {
    return "거래 유형에 맞는 활성 카테고리를 선택해주세요.";
  }

  if (
    error.message.includes("TRANSACTION_ACCOUNT_INVALID") ||
    error.message.includes("TRANSACTION_ACCOUNT_INACTIVE")
  ) {
    return "활성 계좌를 확인해주세요.";
  }

  if (
    error.message.includes("TRANSACTION_CARD_INVALID") ||
    error.message.includes("TRANSACTION_CARD_INACTIVE") ||
    error.message.includes(
      "TRANSACTION_CARD_ACCOUNT_MISMATCH",
    )
  ) {
    return "카드와 카드대금 출금 계좌를 확인해주세요.";
  }

  if (
    error.message.includes(
      "TRANSACTION_RATE_SNAPSHOT_INVALID",
    ) ||
    error.message.includes(
      "TRANSACTION_LIVING_AMOUNT_INVALID",
    ) ||
    error.message.includes(
      "TRANSACTION_ASSET_SNAPSHOT_INVALID",
    )
  ) {
    return "수입 거래의 생활비 반영 스냅샷을 확인해주세요.";
  }

  if (error.code === "23514") {
    return "거래 입력값이 가계부 규칙과 맞지 않습니다.";
  }

  return "거래를 저장하지 못했습니다.";
}

async function resolveIncomeValues({
  categoryId,
  accountId,
  rateRuleId,
  effectiveDate,
  amount,
  ownerType,
  preservedSnapshot,
  existingCategoryId,
  existingAccountId,
}: {
  categoryId: string;
  accountId: string;
  rateRuleId: string;
  effectiveDate: string;
  amount: number;
  ownerType: OwnerType;
  preservedSnapshot?: {
    appliedRateRuleId: string;
    appliedRateBps: number;
    livingAllocatedAmount: number;
    isAssetIncomeSnapshot: boolean;
  };
  existingCategoryId?: string | null;
  existingAccountId?: string | null;
}) {
  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { data: category, error: categoryError } =
    await supabase
      .from("categories")
      .select(
        "id, transaction_type, is_active, rate_rule_id, is_asset_income, default_account_id",
      )
      .eq("id", categoryId)
      .eq("household_id", householdId)
      .maybeSingle();

  if (
    categoryError ||
    !category ||
    category.transaction_type !== "income" ||
    (!category.is_active && category.id !== existingCategoryId)
  ) {
    return {
      ok: false as const,
      message: "활성 수입 카테고리를 선택해주세요.",
    };
  }

  const resolvedAccountId =
    accountId || category.default_account_id || "";

  if (!resolvedAccountId) {
    return {
      ok: false as const,
      message: "수입이 입금된 계좌를 선택해주세요.",
    };
  }

  const { data: account, error: accountError } =
    await supabase
      .from("accounts")
      .select("id, owner_type, is_active")
      .eq("id", resolvedAccountId)
      .eq("household_id", householdId)
      .maybeSingle();

  if (
    accountError ||
    !account ||
    (!account.is_active && account.id !== existingAccountId)
  ) {
    return {
      ok: false as const,
      message: "활성 수령 계좌를 선택해주세요.",
    };
  }

  if (preservedSnapshot) {
    return {
      ok: true as const,
      supabase,
      householdId,
      values: {
        account_id: account.id,
        owner_type: ownerType,
        category_id: category.id,
        card_id: null,
        fund_purpose: null,
        expense_nature: null,
        applied_rate_rule_id:
          preservedSnapshot.appliedRateRuleId,
        applied_living_rate_bps:
          preservedSnapshot.appliedRateBps,
        living_allocated_amount:
          preservedSnapshot.livingAllocatedAmount,
        is_asset_income_snapshot:
          preservedSnapshot.isAssetIncomeSnapshot,
      },
    };
  }

  const selectedRateRuleId =
    rateRuleId || category.rate_rule_id || "";

  if (!selectedRateRuleId) {
    return {
      ok: false as const,
      message: "생활비 반영률을 선택해주세요.",
    };
  }

  const { data: selectedRateRule, error: selectedRateError } =
    await supabase
      .from("rate_rules")
      .select("id, rule_key")
      .eq("id", selectedRateRuleId)
      .eq("household_id", householdId)
      .maybeSingle();

  if (selectedRateError || !selectedRateRule) {
    return {
      ok: false as const,
      message: "생활비 반영률을 찾지 못했습니다.",
    };
  }

  const { data: rateVersions, error: rateVersionsError } =
    await supabase
      .from("rate_rules")
      .select(
        "id, rate_bps, valid_from, valid_to, rule_key",
      )
      .eq("household_id", householdId)
      .eq("rule_key", selectedRateRule.rule_key)
      .lte("valid_from", effectiveDate)
      .order("valid_from", { ascending: false });

  if (rateVersionsError) {
    return {
      ok: false as const,
      message: "생활비 반영률 이력을 확인하지 못했습니다.",
    };
  }

  const appliedRateRule = rateVersions?.find(
    (rule) =>
      rule.valid_to === null ||
      rule.valid_to >= effectiveDate,
  );

  if (!appliedRateRule) {
    return {
      ok: false as const,
      message:
        "선택한 반영일에 적용되는 생활비 반영률이 없습니다.",
    };
  }

  return {
    ok: true as const,
    supabase,
    householdId,
    values: {
      account_id: account.id,
      owner_type: ownerType,
      category_id: category.id,
      card_id: null,
      fund_purpose: null,
      expense_nature: null,
      applied_rate_rule_id: appliedRateRule.id,
      applied_living_rate_bps:
        appliedRateRule.rate_bps,
      living_allocated_amount:
        calculateLivingAllocatedAmount(
          amount,
          appliedRateRule.rate_bps,
        ),
      is_asset_income_snapshot:
        category.is_asset_income ?? false,
    },
  };
}

async function resolveExpenseValues({
  categoryId,
  paymentMethod,
  accountId,
  cardId,
  fundPurpose,
  expenseNature,
  existingCategoryId,
  existingAccountId,
  existingCardId,
}: {
  categoryId: string;
  paymentMethod: string;
  accountId: string;
  cardId: string;
  fundPurpose: FundPurpose;
  expenseNature: ExpenseNature;
  existingCategoryId?: string | null;
  existingAccountId?: string | null;
  existingCardId?: string | null;
}) {
  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { data: category, error: categoryError } =
    await supabase
      .from("categories")
      .select("id, transaction_type, is_active")
      .eq("id", categoryId)
      .eq("household_id", householdId)
      .maybeSingle();

  if (
    categoryError ||
    !category ||
    category.transaction_type !== "expense" ||
    (!category.is_active && category.id !== existingCategoryId)
  ) {
    return {
      ok: false as const,
      message: "활성 지출 카테고리를 선택해주세요.",
    };
  }

  if (paymentMethod === "card") {
    if (!cardId) {
      return {
        ok: false as const,
        message: "결제 카드를 선택해주세요.",
      };
    }

    const { data: card, error: cardError } =
      await supabase
        .from("cards")
        .select(
          "id, owner_type, is_active, payment_account_id",
        )
        .eq("id", cardId)
        .eq("household_id", householdId)
        .maybeSingle();

    if (
      cardError ||
      !card ||
      (!card.is_active && card.id !== existingCardId)
    ) {
      return {
        ok: false as const,
        message: "활성 카드를 선택해주세요.",
      };
    }

    const resolvedPaymentAccountId =
      card.id === existingCardId && existingAccountId
        ? existingAccountId
        : card.payment_account_id;

    const { data: paymentAccount, error: accountError } =
      await supabase
        .from("accounts")
        .select("id, is_active")
        .eq("id", resolvedPaymentAccountId)
        .eq("household_id", householdId)
        .maybeSingle();

    if (
      accountError ||
      !paymentAccount ||
      (!paymentAccount.is_active &&
        paymentAccount.id !== existingAccountId)
    ) {
      return {
        ok: false as const,
        message:
          "카드대금 출금 계좌가 비활성 상태입니다.",
      };
    }

    return {
      ok: true as const,
      supabase,
      householdId,
      values: {
        category_id: category.id,
        account_id: paymentAccount.id,
        card_id: card.id,
        owner_type: card.owner_type,
        fund_purpose: fundPurpose,
        expense_nature: expenseNature,
        applied_rate_rule_id: null,
        applied_living_rate_bps: null,
        living_allocated_amount: null,
        is_asset_income_snapshot: null,
      },
    };
  }

  if (paymentMethod !== "account" || !accountId) {
    return {
      ok: false as const,
      message: "지출 계좌를 선택해주세요.",
    };
  }

  const { data: account, error: accountError } =
    await supabase
      .from("accounts")
      .select("id, owner_type, is_active")
      .eq("id", accountId)
      .eq("household_id", householdId)
      .maybeSingle();

  if (
    accountError ||
    !account ||
    (!account.is_active && account.id !== existingAccountId)
  ) {
    return {
      ok: false as const,
      message: "활성 지출 계좌를 선택해주세요.",
    };
  }

  return {
    ok: true as const,
    supabase,
    householdId,
    values: {
      category_id: category.id,
      account_id: account.id,
      card_id: null,
      owner_type: account.owner_type,
      fund_purpose: fundPurpose,
      expense_nature: expenseNature,
      applied_rate_rule_id: null,
      applied_living_rate_bps: null,
      living_allocated_amount: null,
      is_asset_income_snapshot: null,
    },
  };
}

export async function createTransaction(
  previousState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const transactionType = getText(
    formData,
    "transactionType",
  );
  const name = getText(formData, "name");
  const amount = parseAmount(getText(formData, "amount"));
  const effectiveDate = parseDate(
    getText(formData, "effectiveDate"),
  );
  const status = parseEditableStatus(
    getText(formData, "status"),
  );
  const categoryId = getText(formData, "categoryId");
  const memo = getText(formData, "memo");

  if (transactionType !== "income" && transactionType !== "expense") {
    return errorState(
      previousState,
      "수입 또는 지출 유형을 선택해주세요.",
    );
  }

  if (!name) {
    return errorState(previousState, "거래명을 입력해주세요.");
  }

  if (name.length > 100) {
    return errorState(
      previousState,
      "거래명은 100자 이내로 입력해주세요.",
    );
  }

  if (amount === null) {
    return errorState(
      previousState,
      "금액은 0보다 큰 원 단위 정수로 입력해주세요.",
    );
  }

  if (!effectiveDate) {
    return errorState(
      previousState,
      "올바른 반영일을 입력해주세요.",
    );
  }

  if (!status) {
    return errorState(
      previousState,
      "거래 상태를 선택해주세요.",
    );
  }

  if (!categoryId) {
    return errorState(
      previousState,
      "카테고리를 선택해주세요.",
    );
  }

  let resolution;

  if (transactionType === "income") {
    const ownerType = parseOwnerType(
      getText(formData, "ownerType"),
    );

    if (!ownerType) {
      return errorState(
        previousState,
        "수입 소유자를 선택해주세요.",
      );
    }

    resolution = await resolveIncomeValues({
      categoryId,
      accountId: getText(formData, "accountId"),
      rateRuleId: getText(formData, "rateRuleId"),
      effectiveDate,
      amount,
      ownerType,
    });
  } else {
    const fundPurpose = parseFundPurpose(
      getText(formData, "fundPurpose"),
    );
    const expenseNature = parseExpenseNature(
      getText(formData, "expenseNature"),
    );

    if (!fundPurpose || !expenseNature) {
      return errorState(
        previousState,
        "지출의 자금 목적과 성격을 선택해주세요.",
      );
    }

    resolution = await resolveExpenseValues({
      categoryId,
      paymentMethod: getText(formData, "paymentMethod"),
      accountId: getText(formData, "accountId"),
      cardId: getText(formData, "cardId"),
      fundPurpose,
      expenseNature,
    });
  }

  if (!resolution.ok) {
    return errorState(previousState, resolution.message);
  }

  const insertValues: TransactionInsert = {
    household_id: resolution.householdId,
    effective_date: effectiveDate,
    transaction_type: transactionType,
    name,
    amount,
    status,
    memo: memo || null,
    recurring_rule_id: null,
    settlement_completed_at: null,
    ...resolution.values,
  };

  const { error } = await resolution.supabase
    .from("transactions")
    .insert(insertValues);

  if (error) {
    console.error("Failed to create transaction:", error);

    return errorState(
      previousState,
      getDatabaseErrorMessage(error),
    );
  }

  revalidatePath("/ledger");
  revalidatePath("/");

  return successState("거래를 등록했습니다.");
}

export async function updateTransaction(
  previousState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const transactionId = getText(formData, "transactionId");
  const name = getText(formData, "name");
  const amount = parseAmount(getText(formData, "amount"));
  const effectiveDate = parseDate(
    getText(formData, "effectiveDate"),
  );
  const categoryId = getText(formData, "categoryId");
  const memo = getText(formData, "memo");

  if (!transactionId) {
    return errorState(
      previousState,
      "수정할 거래를 확인하지 못했습니다.",
    );
  }

  if (!name || name.length > 100) {
    return errorState(
      previousState,
      "거래명은 1자 이상 100자 이내로 입력해주세요.",
    );
  }

  if (amount === null || !effectiveDate || !categoryId) {
    return errorState(
      previousState,
      "거래의 필수 입력값을 확인해주세요.",
    );
  }

  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { data: current, error: loadError } =
    await supabase
      .from("transactions")
      .select(
        "id, transaction_type, status, category_id, account_id, card_id, settlement_completed_at, effective_date, amount, owner_type, applied_rate_rule_id, applied_living_rate_bps, living_allocated_amount, is_asset_income_snapshot",
      )
      .eq("id", transactionId)
      .eq("household_id", householdId)
      .maybeSingle();

  if (loadError || !current) {
    return errorState(
      previousState,
      "수정할 거래를 찾지 못했습니다.",
    );
  }

  if (current.settlement_completed_at) {
    return errorState(
      previousState,
      "정산이 완료된 거래는 수정할 수 없습니다.",
    );
  }

  if (
    current.status === "cancelled"
  ) {
    return errorState(
      previousState,
      "취소 처리된 거래는 수정할 수 없습니다.",
    );
  }

  let resolution;

  if (current.transaction_type === "income") {
    const ownerType = parseOwnerType(
      getText(formData, "ownerType"),
    );
    const selectedRateRuleId = getText(
      formData,
      "rateRuleId",
    );

    if (!ownerType) {
      return errorState(
        previousState,
        "수입 소유자를 선택해주세요.",
      );
    }

    const canPreserveSnapshot =
      current.category_id === categoryId &&
      current.effective_date === effectiveDate &&
      current.amount === amount &&
      current.applied_rate_rule_id === selectedRateRuleId &&
      current.applied_rate_rule_id !== null &&
      current.applied_living_rate_bps !== null &&
      current.living_allocated_amount !== null &&
      current.is_asset_income_snapshot !== null;

    const preservedSnapshot =
      canPreserveSnapshot &&
      current.applied_rate_rule_id !== null &&
      current.applied_living_rate_bps !== null &&
      current.living_allocated_amount !== null &&
      current.is_asset_income_snapshot !== null
        ? {
            appliedRateRuleId:
              current.applied_rate_rule_id,
            appliedRateBps:
              current.applied_living_rate_bps,
            livingAllocatedAmount:
              current.living_allocated_amount,
            isAssetIncomeSnapshot:
              current.is_asset_income_snapshot,
          }
        : undefined;

    resolution = await resolveIncomeValues({
      categoryId,
      accountId: getText(formData, "accountId"),
      rateRuleId: selectedRateRuleId,
      effectiveDate,
      amount,
      ownerType,
      preservedSnapshot,
      existingCategoryId: current.category_id,
      existingAccountId: current.account_id,
    });
  } else if (current.transaction_type === "expense") {
    const fundPurpose = parseFundPurpose(
      getText(formData, "fundPurpose"),
    );
    const expenseNature = parseExpenseNature(
      getText(formData, "expenseNature"),
    );

    if (!fundPurpose || !expenseNature) {
      return errorState(
        previousState,
        "지출의 자금 목적과 성격을 선택해주세요.",
      );
    }

    resolution = await resolveExpenseValues({
      categoryId,
      paymentMethod: getText(formData, "paymentMethod"),
      accountId: getText(formData, "accountId"),
      cardId: getText(formData, "cardId"),
      fundPurpose,
      expenseNature,
      existingCategoryId: current.category_id,
      existingAccountId: current.account_id,
      existingCardId: current.card_id,
    });
  } else {
    return errorState(
      previousState,
      "이 화면에서는 이체 거래를 수정할 수 없습니다.",
    );
  }

  if (!resolution.ok) {
    return errorState(previousState, resolution.message);
  }

  const updateValues: TransactionUpdate = {
    effective_date: effectiveDate,
    name,
    amount,
    memo: memo || null,
    ...resolution.values,
  };

  const { data, error } = await resolution.supabase
    .from("transactions")
    .update(updateValues)
    .eq("id", transactionId)
    .eq("household_id", resolution.householdId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to update transaction:", error);

    return errorState(
      previousState,
      getDatabaseErrorMessage(error),
    );
  }

  if (!data) {
    return errorState(
      previousState,
      "수정할 거래를 찾지 못했습니다.",
    );
  }

  revalidatePath("/ledger");
  revalidatePath("/");

  return successState("거래 정보를 수정했습니다.");
}

export async function changeTransactionStatus(
  previousState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const transactionId = getText(formData, "transactionId");
  const nextStatus = getText(
    formData,
    "nextStatus",
  );

  if (!transactionId) {
    return errorState(
      previousState,
      "거래를 확인하지 못했습니다.",
    );
  }

  if (
    nextStatus !== "confirmed" &&
    nextStatus !== "cancelled"
  ) {
    return errorState(
      previousState,
      "변경할 거래 상태가 올바르지 않습니다.",
    );
  }

  const { supabase } = await requireCurrentHousehold();

  const { error } = await supabase.rpc(
    "set_transaction_status",
    {
      p_transaction_id: transactionId,
      p_status: nextStatus,
    },
  );

  if (error) {
    console.error(
      "Failed to change transaction status:",
      error,
    );

    if (
      error.message.includes(
        "TRANSACTION_ALREADY_SETTLED",
      )
    ) {
      return errorState(
        previousState,
        "정산이 완료된 거래의 상태는 변경할 수 없습니다.",
      );
    }

    if (
      error.message.includes(
        "TRANSACTION_STATUS_TRANSITION_INVALID",
      )
    ) {
      return errorState(
        previousState,
        "현재 상태에서는 요청한 상태로 변경할 수 없습니다.",
      );
    }

    return errorState(
      previousState,
      "거래 상태를 변경하지 못했습니다.",
    );
  }

  revalidatePath("/ledger");
  revalidatePath("/");

  const messages: Record<string, string> = {
    confirmed: "거래를 확정했습니다.",
    cancelled: "거래를 취소 처리했습니다.",
  };

  return successState(messages[nextStatus]);
}

export async function deletePlannedTransaction(
  previousState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const transactionId = getText(formData, "transactionId");

  if (!transactionId) {
    return errorState(
      previousState,
      "삭제할 거래를 확인하지 못했습니다.",
    );
  }

  const { supabase } = await requireCurrentHousehold();

  const { error } = await supabase.rpc(
    "delete_planned_manual_transaction",
    {
      p_transaction_id: transactionId,
    },
  );

  if (error) {
    console.error("Failed to delete transaction:", error);

    if (
      error.message.includes(
        "TRANSACTION_DELETE_NOT_ALLOWED",
      )
    ) {
      return errorState(
        previousState,
        "직접 등록한 예정 거래만 완전히 삭제할 수 있습니다. 확정 거래는 취소 처리해주세요.",
      );
    }

    return errorState(
      previousState,
      "거래를 삭제하지 못했습니다.",
    );
  }

  revalidatePath("/ledger");
  revalidatePath("/");

  return successState("예정 거래를 삭제했습니다.");
}

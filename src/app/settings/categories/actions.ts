"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentHousehold } from "@/lib/household/current";
import type { Database } from "@/types/database.types";

type TransactionType = "income" | "expense";
type FundPurpose = "living" | "investment";
type ExpenseNature = "fixed" | "variable" | "irregular";

type CategoryUpdate =
  Database["public"]["Tables"]["categories"]["Update"];

export type CategoryActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseTransactionType(
  value: string,
): TransactionType | null {
  if (value === "income" || value === "expense") {
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

function getCategoryErrorMessage(error: {
  code?: string;
  message: string;
}) {
  if (error.code === "23505") {
    return "같은 이름의 카테고리가 이미 등록되어 있습니다.";
  }

  if (
    error.message.includes("CATEGORY_RATE_RULE_REQUIRED")
  ) {
    return "수입 카테고리의 생활비 반영률을 선택해주세요.";
  }

  if (
    error.message.includes("CATEGORY_RATE_RULE_INVALID") ||
    error.message.includes(
      "CATEGORY_RATE_RULE_NOT_CURRENT",
    )
  ) {
    return "현재 적용 중인 생활비 반영률을 선택해주세요.";
  }

  if (
    error.message.includes(
      "CATEGORY_DEFAULT_ACCOUNT_INVALID",
    )
  ) {
    return "기본 수령 계좌를 확인해주세요.";
  }

  if (
    error.message.includes(
      "CATEGORY_DEFAULT_ACCOUNT_INACTIVE",
    )
  ) {
    return "비활성 계좌는 새로운 기본 수령 계좌로 지정할 수 없습니다.";
  }

  if (
    error.message.includes(
      "CATEGORY_EXPENSE_DEFAULT_REQUIRED",
    )
  ) {
    return "지출 카테고리의 자금 목적과 지출 성격을 선택해주세요.";
  }

  return "카테고리 정보를 저장하지 못했습니다.";
}

function validateName(name: string): CategoryActionState | null {
  if (!name) {
    return {
      status: "error",
      message: "카테고리명을 입력해주세요.",
    };
  }

  if (name.length > 50) {
    return {
      status: "error",
      message: "카테고리명은 50자 이내로 입력해주세요.",
    };
  }

  return null;
}

export async function createCategory(
  _previousState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const name = getText(formData, "name");
  const transactionType = parseTransactionType(
    getText(formData, "transactionType"),
  );

  const nameError = validateName(name);

  if (nameError) {
    return nameError;
  }

  if (!transactionType) {
    return {
      status: "error",
      message: "카테고리 유형을 선택해주세요.",
    };
  }

  const { supabase, householdId } =
    await requireCurrentHousehold();

  if (transactionType === "income") {
    const rateRuleId = getText(
      formData,
      "rateRuleId",
    );
    const defaultAccountId = getText(
      formData,
      "defaultAccountId",
    );
    const isAssetIncome =
      formData.get("isAssetIncome") === "on";

    if (!rateRuleId) {
      return {
        status: "error",
        message:
          "수입 카테고리의 생활비 반영률을 선택해주세요.",
      };
    }

    const { error } = await supabase
      .from("categories")
      .insert({
        household_id: householdId,
        transaction_type: "income",
        parent_id: null,
        name,
        suggested_fund_purpose: null,
        suggested_expense_nature: null,
        rate_rule_id: rateRuleId,
        is_asset_income: isAssetIncome,
        default_account_id:
          defaultAccountId || null,
        is_active: true,
        sort_order: 0,
      });

    if (error) {
      console.error(
        "Failed to create income category:",
        error,
      );

      return {
        status: "error",
        message: getCategoryErrorMessage(error),
      };
    }
  } else {
    const fundPurpose = parseFundPurpose(
      getText(formData, "fundPurpose"),
    );
    const expenseNature = parseExpenseNature(
      getText(formData, "expenseNature"),
    );

    if (!fundPurpose || !expenseNature) {
      return {
        status: "error",
        message:
          "지출 카테고리의 자금 목적과 지출 성격을 선택해주세요.",
      };
    }

    const { error } = await supabase
      .from("categories")
      .insert({
        household_id: householdId,
        transaction_type: "expense",
        parent_id: null,
        name,
        suggested_fund_purpose: fundPurpose,
        suggested_expense_nature: expenseNature,
        rate_rule_id: null,
        is_asset_income: null,
        default_account_id: null,
        is_active: true,
        sort_order: 0,
      });

    if (error) {
      console.error(
        "Failed to create expense category:",
        error,
      );

      return {
        status: "error",
        message: getCategoryErrorMessage(error),
      };
    }
  }

  revalidatePath("/settings");

  return {
    status: "success",
    message: "카테고리를 등록했습니다.",
  };
}

export async function updateCategory(
  _previousState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const categoryId = getText(formData, "categoryId");
  const name = getText(formData, "name");

  if (!categoryId) {
    return {
      status: "error",
      message: "수정할 카테고리를 확인하지 못했습니다.",
    };
  }

  const nameError = validateName(name);

  if (nameError) {
    return nameError;
  }

  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { data: currentCategory, error: loadError } =
    await supabase
      .from("categories")
      .select("id, transaction_type")
      .eq("id", categoryId)
      .eq("household_id", householdId)
      .maybeSingle();

  if (loadError || !currentCategory) {
    console.error(
      "Failed to load category:",
      loadError,
    );

    return {
      status: "error",
      message: "수정할 카테고리를 찾지 못했습니다.",
    };
  }

  let updateValues: CategoryUpdate;

  if (currentCategory.transaction_type === "income") {
    const rateRuleId = getText(
      formData,
      "rateRuleId",
    );
    const defaultAccountId = getText(
      formData,
      "defaultAccountId",
    );
    const isAssetIncome =
      formData.get("isAssetIncome") === "on";

    if (!rateRuleId) {
      return {
        status: "error",
        message:
          "수입 카테고리의 생활비 반영률을 선택해주세요.",
      };
    }

    updateValues = {
      name,
      rate_rule_id: rateRuleId,
      is_asset_income: isAssetIncome,
      default_account_id:
        defaultAccountId || null,
      suggested_fund_purpose: null,
      suggested_expense_nature: null,
    };
  } else {
    const fundPurpose = parseFundPurpose(
      getText(formData, "fundPurpose"),
    );
    const expenseNature = parseExpenseNature(
      getText(formData, "expenseNature"),
    );

    if (!fundPurpose || !expenseNature) {
      return {
        status: "error",
        message:
          "지출 카테고리의 자금 목적과 지출 성격을 선택해주세요.",
      };
    }

    updateValues = {
      name,
      suggested_fund_purpose: fundPurpose,
      suggested_expense_nature: expenseNature,
      rate_rule_id: null,
      is_asset_income: null,
      default_account_id: null,
    };
  }

  const { data, error } = await supabase
    .from("categories")
    .update(updateValues)
    .eq("id", categoryId)
    .eq("household_id", householdId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to update category:", error);

    return {
      status: "error",
      message: getCategoryErrorMessage(error),
    };
  }

  if (!data) {
    return {
      status: "error",
      message: "수정할 카테고리를 찾지 못했습니다.",
    };
  }

  revalidatePath("/settings");

  return {
    status: "success",
    message: "카테고리 정보를 수정했습니다.",
  };
}

export async function toggleCategoryActive(
  _previousState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const categoryId = getText(formData, "categoryId");
  const nextActive =
    getText(formData, "nextActive") === "true";

  if (!categoryId) {
    return {
      status: "error",
      message: "카테고리를 확인하지 못했습니다.",
    };
  }

  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { data, error } = await supabase
    .from("categories")
    .update({
      is_active: nextActive,
    })
    .eq("id", categoryId)
    .eq("household_id", householdId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      "Failed to toggle category:",
      error,
    );

    return {
      status: "error",
      message: "카테고리 상태를 변경하지 못했습니다.",
    };
  }

  if (!data) {
    return {
      status: "error",
      message: "카테고리를 찾지 못했습니다.",
    };
  }

  revalidatePath("/settings");

  return {
    status: "success",
    message: nextActive
      ? "카테고리를 다시 활성화했습니다."
      : "카테고리를 비활성화했습니다.",
  };
}

export async function deleteCategory(
  _previousState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const categoryId = getText(formData, "categoryId");

  if (!categoryId) {
    return {
      status: "error",
      message: "삭제할 카테고리를 확인하지 못했습니다.",
    };
  }

  const { supabase } = await requireCurrentHousehold();

  const { error } = await supabase.rpc(
    "delete_unused_category",
    {
      p_category_id: categoryId,
    },
  );

  if (error) {
    console.error("Failed to delete category:", error);

    if (error.message.includes("CATEGORY_IN_USE")) {
      return {
        status: "error",
        message:
          "거래나 정기항목에 사용된 카테고리는 삭제할 수 없습니다. 비활성화해주세요.",
      };
    }

    if (
      error.message.includes("CATEGORY_HAS_CHILDREN")
    ) {
      return {
        status: "error",
        message:
          "하위 카테고리가 있는 카테고리는 삭제할 수 없습니다.",
      };
    }

    if (
      error.message.includes("CATEGORY_NOT_FOUND")
    ) {
      return {
        status: "error",
        message: "삭제할 카테고리를 찾지 못했습니다.",
      };
    }

    return {
      status: "error",
      message: "카테고리를 삭제하지 못했습니다.",
    };
  }

  revalidatePath("/settings");

  return {
    status: "success",
    message: "카테고리를 삭제했습니다.",
  };
}

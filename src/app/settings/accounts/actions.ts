"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentHousehold } from "@/lib/household/current";

type OwnerType = "wife" | "husband" | "joint";

export type AccountActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
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

function getDatabaseErrorMessage(error: {
  code?: string;
  message: string;
}) {
  if (error.code === "23505") {
    return "같은 이름의 계좌가 이미 등록되어 있습니다.";
  }

  if (error.code === "23514") {
    return "계좌 설정값을 확인해주세요.";
  }

  return "계좌 정보를 저장하지 못했습니다.";
}

export async function createAccount(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const name = getText(formData, "name");
  const ownerType = parseOwnerType(
    getText(formData, "ownerType"),
  );
  const memo = getText(formData, "memo");
  const isLivingAccount =
    formData.get("isLivingAccount") === "on";

  if (!name) {
    return {
      status: "error",
      message: "계좌명을 입력해주세요.",
    };
  }

  if (name.length > 50) {
    return {
      status: "error",
      message: "계좌명은 50자 이내로 입력해주세요.",
    };
  }

  if (!ownerType) {
    return {
      status: "error",
      message: "계좌 소유자를 선택해주세요.",
    };
  }

  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { data: account, error } = await supabase
    .from("accounts")
    .insert({
      household_id: householdId,
      name,
      owner_type: ownerType,
      is_living_account: false,
      is_active: true,
      memo: memo || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create account:", error);

    return {
      status: "error",
      message: getDatabaseErrorMessage(error),
    };
  }

  if (isLivingAccount) {
    const { error: livingAccountError } =
      await supabase.rpc("set_living_account", {
        p_account_id: account.id,
      });

    if (livingAccountError) {
      console.error(
        "Failed to set living account:",
        livingAccountError,
      );

      const { error: cleanupError } =
        await supabase.rpc("delete_unused_account", {
          p_account_id: account.id,
        });

      if (cleanupError) {
        console.error(
          "Failed to clean up account:",
          cleanupError,
        );
      }

      return {
        status: "error",
        message:
          "대표 생활비 계좌로 지정하지 못했습니다.",
      };
    }
  }

  revalidatePath("/settings");

  return {
    status: "success",
    message: "계좌를 등록했습니다.",
  };
}

export async function updateAccount(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const accountId = getText(formData, "accountId");
  const name = getText(formData, "name");
  const ownerType = parseOwnerType(
    getText(formData, "ownerType"),
  );
  const memo = getText(formData, "memo");

  if (!accountId) {
    return {
      status: "error",
      message: "수정할 계좌를 확인하지 못했습니다.",
    };
  }

  if (!name) {
    return {
      status: "error",
      message: "계좌명을 입력해주세요.",
    };
  }

  if (name.length > 50) {
    return {
      status: "error",
      message: "계좌명은 50자 이내로 입력해주세요.",
    };
  }

  if (!ownerType) {
    return {
      status: "error",
      message: "계좌 소유자를 선택해주세요.",
    };
  }

  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { data, error } = await supabase
    .from("accounts")
    .update({
      name,
      owner_type: ownerType,
      memo: memo || null,
    })
    .eq("id", accountId)
    .eq("household_id", householdId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to update account:", error);

    return {
      status: "error",
      message: getDatabaseErrorMessage(error),
    };
  }

  if (!data) {
    return {
      status: "error",
      message: "수정할 계좌를 찾지 못했습니다.",
    };
  }

  revalidatePath("/settings");

  return {
    status: "success",
    message: "계좌 정보를 수정했습니다.",
  };
}

export async function setLivingAccount(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const accountId = getText(formData, "accountId");

  if (!accountId) {
    return {
      status: "error",
      message: "계좌를 확인하지 못했습니다.",
    };
  }

  const { supabase } = await requireCurrentHousehold();

  const { error } = await supabase.rpc(
    "set_living_account",
    {
      p_account_id: accountId,
    },
  );

  if (error) {
    console.error(
      "Failed to set living account:",
      error,
    );

    return {
      status: "error",
      message:
        "대표 생활비 계좌로 지정하지 못했습니다.",
    };
  }

  revalidatePath("/settings");

  return {
    status: "success",
    message: "대표 생활비 계좌를 변경했습니다.",
  };
}

export async function toggleAccountActive(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const accountId = getText(formData, "accountId");
  const nextActive =
    getText(formData, "nextActive") === "true";

  if (!accountId) {
    return {
      status: "error",
      message: "계좌를 확인하지 못했습니다.",
    };
  }

  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { data: account, error: accountError } =
    await supabase
      .from("accounts")
      .select("id, is_active, is_living_account")
      .eq("id", accountId)
      .eq("household_id", householdId)
      .maybeSingle();

  if (accountError || !account) {
    console.error(
      "Failed to load account:",
      accountError,
    );

    return {
      status: "error",
      message: "계좌를 찾지 못했습니다.",
    };
  }

  if (!nextActive && account.is_living_account) {
    return {
      status: "error",
      message:
        "대표 생활비 계좌는 비활성화할 수 없습니다. 다른 계좌를 먼저 대표로 지정해주세요.",
    };
  }

  const { data, error } = await supabase
    .from("accounts")
    .update({
      is_active: nextActive,
    })
    .eq("id", accountId)
    .eq("household_id", householdId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      "Failed to toggle account:",
      error,
    );

    return {
      status: "error",
      message: "계좌 상태를 변경하지 못했습니다.",
    };
  }

  if (!data) {
    return {
      status: "error",
      message: "계좌를 찾지 못했습니다.",
    };
  }

  revalidatePath("/settings");

  return {
    status: "success",
    message: nextActive
      ? "계좌를 다시 활성화했습니다."
      : "계좌를 비활성화했습니다.",
  };
}

export async function deleteAccount(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const accountId = getText(formData, "accountId");

  if (!accountId) {
    return {
      status: "error",
      message: "삭제할 계좌를 확인하지 못했습니다.",
    };
  }

  const { supabase } = await requireCurrentHousehold();

  const { error } = await supabase.rpc(
    "delete_unused_account",
    {
      p_account_id: accountId,
    },
  );

  if (error) {
    console.error("Failed to delete account:", error);

    if (error.message.includes("ACCOUNT_IS_LIVING")) {
      return {
        status: "error",
        message:
          "대표 생활비 계좌는 삭제할 수 없습니다. 다른 계좌를 먼저 대표로 지정해주세요.",
      };
    }

    if (error.message.includes("ACCOUNT_IN_USE")) {
      return {
        status: "error",
        message:
          "카드·카테고리·거래·정기항목 등에 사용된 계좌는 삭제할 수 없습니다. 비활성화해주세요.",
      };
    }

    if (error.message.includes("ACCOUNT_NOT_FOUND")) {
      return {
        status: "error",
        message: "삭제할 계좌를 찾지 못했습니다.",
      };
    }

    if (error.message.includes("ACCOUNT_ACCESS_DENIED")) {
      return {
        status: "error",
        message: "이 계좌를 삭제할 권한이 없습니다.",
      };
    }

    return {
      status: "error",
      message: "계좌를 삭제하지 못했습니다.",
    };
  }

  revalidatePath("/settings");

  return {
    status: "success",
    message: "계좌를 삭제했습니다.",
  };
}
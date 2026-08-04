"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentHousehold } from "@/lib/household/current";

type OwnerType = "wife" | "husband" | "joint";

export type CardActionState = {
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

function parsePaymentDay(value: string) {
  const paymentDay = Number(value);

  if (
    !Number.isInteger(paymentDay) ||
    paymentDay < 1 ||
    paymentDay > 31
  ) {
    return null;
  }

  return paymentDay;
}

function getDatabaseErrorMessage(error: {
  code?: string;
  message: string;
}) {
  if (error.code === "23505") {
    return "같은 이름의 카드가 이미 등록되어 있습니다.";
  }

  if (
    error.code === "23514" ||
    error.message.includes("CARD_PAYMENT_ACCOUNT_INVALID")
  ) {
    return "카드 설정값이나 결제 계좌를 확인해주세요.";
  }

  if (
    error.message.includes(
      "CARD_PAYMENT_ACCOUNT_INACTIVE",
    )
  ) {
    return "비활성 계좌는 새 결제 계좌로 지정할 수 없습니다.";
  }

  return "카드 정보를 저장하지 못했습니다.";
}

export async function createCard(
  _previousState: CardActionState,
  formData: FormData,
): Promise<CardActionState> {
  const name = getText(formData, "name");
  const ownerType = parseOwnerType(
    getText(formData, "ownerType"),
  );
  const paymentAccountId = getText(
    formData,
    "paymentAccountId",
  );
  const paymentDay = parsePaymentDay(
    getText(formData, "paymentDay"),
  );
  const usagePeriodNote = getText(
    formData,
    "usagePeriodNote",
  );

  if (!name) {
    return {
      status: "error",
      message: "카드명을 입력해주세요.",
    };
  }

  if (name.length > 50) {
    return {
      status: "error",
      message: "카드명은 50자 이내로 입력해주세요.",
    };
  }

  if (!ownerType) {
    return {
      status: "error",
      message: "카드 소유자를 선택해주세요.",
    };
  }

  if (!paymentAccountId) {
    return {
      status: "error",
      message: "카드대금 출금 계좌를 선택해주세요.",
    };
  }

  if (!paymentDay) {
    return {
      status: "error",
      message: "결제일은 1일부터 31일 사이여야 합니다.",
    };
  }

  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { data: paymentAccount, error: accountError } =
    await supabase
      .from("accounts")
      .select("id, is_active")
      .eq("id", paymentAccountId)
      .eq("household_id", householdId)
      .maybeSingle();

  if (accountError || !paymentAccount) {
    return {
      status: "error",
      message: "카드대금 출금 계좌를 찾지 못했습니다.",
    };
  }

  if (!paymentAccount.is_active) {
    return {
      status: "error",
      message:
        "비활성 계좌는 카드대금 출금 계좌로 지정할 수 없습니다.",
    };
  }

  const { error } = await supabase.from("cards").insert({
    household_id: householdId,
    name,
    owner_type: ownerType,
    payment_account_id: paymentAccountId,
    payment_day: paymentDay,
    usage_period_note: usagePeriodNote || null,
    is_active: true,
  });

  if (error) {
    console.error("Failed to create card:", error);

    return {
      status: "error",
      message: getDatabaseErrorMessage(error),
    };
  }

  revalidatePath("/settings");

  return {
    status: "success",
    message: "카드를 등록했습니다.",
  };
}

export async function updateCard(
  _previousState: CardActionState,
  formData: FormData,
): Promise<CardActionState> {
  const cardId = getText(formData, "cardId");
  const name = getText(formData, "name");
  const ownerType = parseOwnerType(
    getText(formData, "ownerType"),
  );
  const paymentAccountId = getText(
    formData,
    "paymentAccountId",
  );
  const paymentDay = parsePaymentDay(
    getText(formData, "paymentDay"),
  );
  const usagePeriodNote = getText(
    formData,
    "usagePeriodNote",
  );

  if (!cardId) {
    return {
      status: "error",
      message: "수정할 카드를 확인하지 못했습니다.",
    };
  }

  if (!name) {
    return {
      status: "error",
      message: "카드명을 입력해주세요.",
    };
  }

  if (name.length > 50) {
    return {
      status: "error",
      message: "카드명은 50자 이내로 입력해주세요.",
    };
  }

  if (!ownerType) {
    return {
      status: "error",
      message: "카드 소유자를 선택해주세요.",
    };
  }

  if (!paymentAccountId) {
    return {
      status: "error",
      message: "카드대금 출금 계좌를 선택해주세요.",
    };
  }

  if (!paymentDay) {
    return {
      status: "error",
      message: "결제일은 1일부터 31일 사이여야 합니다.",
    };
  }

  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { data: currentCard, error: cardError } =
    await supabase
      .from("cards")
      .select("id, payment_account_id")
      .eq("id", cardId)
      .eq("household_id", householdId)
      .maybeSingle();

  if (cardError || !currentCard) {
    return {
      status: "error",
      message: "수정할 카드를 찾지 못했습니다.",
    };
  }

  const { data: paymentAccount, error: accountError } =
    await supabase
      .from("accounts")
      .select("id, is_active")
      .eq("id", paymentAccountId)
      .eq("household_id", householdId)
      .maybeSingle();

  if (accountError || !paymentAccount) {
    return {
      status: "error",
      message: "카드대금 출금 계좌를 찾지 못했습니다.",
    };
  }

  if (
    !paymentAccount.is_active &&
    paymentAccountId !== currentCard.payment_account_id
  ) {
    return {
      status: "error",
      message:
        "비활성 계좌를 새로운 결제 계좌로 지정할 수 없습니다.",
    };
  }

  const { error } = await supabase
    .from("cards")
    .update({
      name,
      owner_type: ownerType,
      payment_account_id: paymentAccountId,
      payment_day: paymentDay,
      usage_period_note: usagePeriodNote || null,
    })
    .eq("id", cardId)
    .eq("household_id", householdId);

  if (error) {
    console.error("Failed to update card:", error);

    return {
      status: "error",
      message: getDatabaseErrorMessage(error),
    };
  }

  revalidatePath("/settings");

  return {
    status: "success",
    message: "카드 정보를 수정했습니다.",
  };
}

export async function toggleCardActive(
  _previousState: CardActionState,
  formData: FormData,
): Promise<CardActionState> {
  const cardId = getText(formData, "cardId");
  const nextActive =
    getText(formData, "nextActive") === "true";

  if (!cardId) {
    return {
      status: "error",
      message: "카드를 확인하지 못했습니다.",
    };
  }

  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { data, error } = await supabase
    .from("cards")
    .update({
      is_active: nextActive,
    })
    .eq("id", cardId)
    .eq("household_id", householdId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      "Failed to toggle card active state:",
      error,
    );

    return {
      status: "error",
      message: "카드 상태를 변경하지 못했습니다.",
    };
  }

  if (!data) {
    return {
      status: "error",
      message: "카드를 찾지 못했습니다.",
    };
  }

  revalidatePath("/settings");

  return {
    status: "success",
    message: nextActive
      ? "카드를 다시 활성화했습니다."
      : "카드를 비활성화했습니다.",
  };
}

export async function deleteCard(
  _previousState: CardActionState,
  formData: FormData,
): Promise<CardActionState> {
  const cardId = getText(formData, "cardId");

  if (!cardId) {
    return {
      status: "error",
      message: "삭제할 카드를 확인하지 못했습니다.",
    };
  }

  const { supabase } = await requireCurrentHousehold();

  const { error } = await supabase.rpc(
    "delete_unused_card",
    {
      p_card_id: cardId,
    },
  );

  if (error) {
    console.error("Failed to delete card:", error);

    if (error.message.includes("CARD_IN_USE")) {
      return {
        status: "error",
        message:
          "거래나 정기항목에 사용된 카드는 삭제할 수 없습니다. 비활성화해주세요.",
      };
    }

    if (error.message.includes("CARD_NOT_FOUND")) {
      return {
        status: "error",
        message: "삭제할 카드를 찾지 못했습니다.",
      };
    }

    return {
      status: "error",
      message: "카드를 삭제하지 못했습니다.",
    };
  }

  revalidatePath("/settings");

  return {
    status: "success",
    message: "카드를 삭제했습니다.",
  };
}
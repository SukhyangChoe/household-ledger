"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentHousehold } from "@/lib/household/current";

export type RateRuleActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseRateBps(value: string) {
  const normalized = value.replace(",", ".");

  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const percent = Number(normalized);

  if (
    !Number.isFinite(percent) ||
    percent < 0 ||
    percent > 100
  ) {
    return null;
  }

  return Math.round(percent * 100);
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsedDate = new Date(`${value}T00:00:00Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return value;
}

function getRateRuleErrorMessage(error: {
  message: string;
}) {
  if (
    error.message.includes("RATE_RULE_NAME_EXISTS")
  ) {
    return "같은 이름의 현재 반영률 규칙이 이미 있습니다.";
  }

  if (
    error.message.includes(
      "RATE_RULE_FUTURE_NOT_ALLOWED",
    )
  ) {
    return "적용 시작일은 오늘 이후로 설정할 수 없습니다.";
  }

  if (
    error.message.includes("RATE_RULE_DATE_INVALID")
  ) {
    return "새 적용일은 기존 버전의 시작일보다 뒤여야 합니다.";
  }

  if (
    error.message.includes("RATE_RULE_NOT_CURRENT")
  ) {
    return "종료된 과거 버전은 다시 변경할 수 없습니다.";
  }

  if (
    error.message.includes("RATE_RULE_NOT_FOUND")
  ) {
    return "변경할 반영률 규칙을 찾지 못했습니다.";
  }

  return "생활비 반영률을 저장하지 못했습니다.";
}

export async function createRateRule(
  _previousState: RateRuleActionState,
  formData: FormData,
): Promise<RateRuleActionState> {
  const name = getText(formData, "name");
  const rateBps = parseRateBps(
    getText(formData, "ratePercent"),
  );
  const validFrom = parseDate(
    getText(formData, "validFrom"),
  );
  const memo = getText(formData, "memo");

  if (!name) {
    return {
      status: "error",
      message: "반영률 이름을 입력해주세요.",
    };
  }

  if (name.length > 50) {
    return {
      status: "error",
      message: "반영률 이름은 50자 이내로 입력해주세요.",
    };
  }

  if (rateBps === null) {
    return {
      status: "error",
      message:
        "반영률은 0%부터 100% 사이로 입력해주세요.",
    };
  }

  if (!validFrom) {
    return {
      status: "error",
      message: "올바른 적용 시작일을 입력해주세요.",
    };
  }

  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { error } = await supabase.rpc(
    "create_rate_rule",
    {
      p_household_id: householdId,
      p_name: name,
      p_rate_bps: rateBps,
      p_valid_from: validFrom,
      p_memo: memo || "",
    },
  );

  if (error) {
    console.error("Failed to create rate rule:", error);

    return {
      status: "error",
      message: getRateRuleErrorMessage(error),
    };
  }

  revalidatePath("/settings");

  return {
    status: "success",
    message: "생활비 반영률 규칙을 등록했습니다.",
  };
}

export async function createRateRuleVersion(
  _previousState: RateRuleActionState,
  formData: FormData,
): Promise<RateRuleActionState> {
  const rateRuleId = getText(
    formData,
    "rateRuleId",
  );
  const name = getText(formData, "name");
  const rateBps = parseRateBps(
    getText(formData, "ratePercent"),
  );
  const validFrom = parseDate(
    getText(formData, "validFrom"),
  );
  const memo = getText(formData, "memo");

  if (!rateRuleId) {
    return {
      status: "error",
      message: "변경할 반영률 규칙을 확인하지 못했습니다.",
    };
  }

  if (!name) {
    return {
      status: "error",
      message: "반영률 이름을 입력해주세요.",
    };
  }

  if (name.length > 50) {
    return {
      status: "error",
      message: "반영률 이름은 50자 이내로 입력해주세요.",
    };
  }

  if (rateBps === null) {
    return {
      status: "error",
      message:
        "반영률은 0%부터 100% 사이로 입력해주세요.",
    };
  }

  if (!validFrom) {
    return {
      status: "error",
      message: "올바른 적용 시작일을 입력해주세요.",
    };
  }

  const { supabase } = await requireCurrentHousehold();

  const { error } = await supabase.rpc(
    "create_rate_rule_version",
    {
      p_rate_rule_id: rateRuleId,
      p_name: name,
      p_rate_bps: rateBps,
      p_valid_from: validFrom,
      p_memo: memo || "",
    },
  );

  if (error) {
    console.error(
      "Failed to create rate rule version:",
      error,
    );

    return {
      status: "error",
      message: getRateRuleErrorMessage(error),
    };
  }

  revalidatePath("/settings");

  return {
    status: "success",
    message:
      "새 반영률 버전을 생성하고 이전 이력을 보존했습니다.",
  };
}
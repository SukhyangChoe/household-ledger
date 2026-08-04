"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type OnboardingState = {
  error: string | null;
};

export async function createHousehold(
  _previousState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const householdName = String(
    formData.get("householdName") ?? "",
  ).trim();

  const displayName = String(
    formData.get("displayName") ?? "",
  ).trim();

  if (!householdName) {
    return {
      error: "가계 이름을 입력해주세요.",
    };
  }

  if (!displayName) {
    return {
      error: "사용자 표시 이름을 입력해주세요.",
    };
  }

  if (householdName.length > 50) {
    return {
      error: "가계 이름은 50자 이내로 입력해주세요.",
    };
  }

  if (displayName.length > 30) {
    return {
      error: "사용자 표시 이름은 30자 이내로 입력해주세요.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: householdId, error } = await supabase.rpc(
    "create_household_with_admin",
    {
      p_household_name: householdName,
      p_display_name: displayName,
    },
  );

  if (error) {
    console.error(
      "Failed to create household:",
      error.message,
    );

    if (
      error.message.includes(
        "already belongs to an active household",
      )
    ) {
      return {
        error: "이미 연결된 가계가 있습니다.",
      };
    }

    return {
      error:
        "가계를 생성하지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  if (!householdId) {
    return {
      error: "가계 생성 결과를 확인하지 못했습니다.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/settings");
}
import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function requireCurrentHousehold() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } =
    await supabase
      .from("household_members")
      .select("household_id, display_name, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

  if (membershipError) {
    console.error(
      "Failed to load household membership:",
      membershipError.message,
    );

    throw new Error(
      "현재 가계 정보를 불러오지 못했습니다.",
    );
  }

  if (!membership) {
    redirect("/onboarding");
  }

  return {
    supabase,
    user,
    householdId: membership.household_id,
    displayName: membership.display_name,
    role: membership.role,
  };
}
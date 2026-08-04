"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut({
    scope: "local",
  });

  if (error) {
    console.error("Supabase logout failed:", error.message);

    throw new Error(
      "로그아웃에 실패했습니다. 잠시 후 다시 시도해주세요.",
    );
  }

  revalidatePath("/", "layout");
  redirect("/login");
}
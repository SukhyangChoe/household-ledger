import { redirect } from "next/navigation";

import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
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
      .select("household_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

  if (membershipError) {
    console.error(
      "Failed to check household membership:",
      membershipError.message,
    );

    throw new Error(
      "가계 연결 상태를 확인하지 못했습니다.",
    );
  }

  if (membership) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">
          최초 설정
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          우리집 가계를 만들어주세요
        </h1>

        <p className="mt-4 text-sm leading-6 text-slate-500">
          먼저 가계 이름을 만든 뒤,
          설정 시작 화면에서 계좌와
          생활비 계좌 → 생활비 반영률
          → 수입·지출 카테고리 순서로
          준비할 수 있습니다.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-600">
          <div className="rounded-xl bg-slate-50 px-2 py-3">
            1. 계좌
          </div>
          <div className="rounded-xl bg-slate-50 px-2 py-3">
            2. 반영률
          </div>
          <div className="rounded-xl bg-slate-50 px-2 py-3">
            3. 카테고리
          </div>
        </div>

        <OnboardingForm />
      </section>
    </main>
  );
}

"use client";

import { useActionState } from "react";

import {
  createHousehold,
  type OnboardingState,
} from "@/app/onboarding/actions";

const initialState: OnboardingState = {
  error: null,
};

export function OnboardingForm() {
  const [state, formAction, isPending] = useActionState(
    createHousehold,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label
          htmlFor="householdName"
          className="text-sm font-medium text-slate-700"
        >
          가계 이름
        </label>

        <input
          id="householdName"
          name="householdName"
          type="text"
          defaultValue="우리집"
          maxLength={50}
          required
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />

        <p className="mt-2 text-xs text-slate-500">
          프로그램 안에서 우리 가계를 구분하는 이름입니다.
        </p>
      </div>

      <div>
        <label
          htmlFor="displayName"
          className="text-sm font-medium text-slate-700"
        >
          내 표시 이름
        </label>

        <input
          id="displayName"
          name="displayName"
          type="text"
          defaultValue="아내"
          maxLength={30}
          required
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />

        <p className="mt-2 text-xs text-slate-500">
          계좌 소유자와 관리자를 표시할 때 사용하는 이름입니다.
        </p>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending
          ? "우리집을 만드는 중..."
          : "우리집 가계 시작하기"}
      </button>
    </form>
  );
}
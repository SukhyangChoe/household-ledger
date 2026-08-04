"use client";

import { useActionState } from "react";

import {
  login,
  type LoginState,
} from "@/app/login/actions";

const initialState: LoginState = {
  error: null,
};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    login,
    initialState,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            우리집 가계관리
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            로그인
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            등록된 가족 계정으로 로그인해주세요.
          </p>
        </div>

        <form action={formAction} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="text-sm font-medium text-slate-700"
            >
              이메일
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-slate-700"
            >
              비밀번호
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
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
            {isPending ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </section>
    </main>
  );
}
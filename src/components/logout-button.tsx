"use client";

import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";

import { logout } from "@/app/auth/actions";

function LogoutSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}

export function LogoutButton() {
  const pathname = usePathname();

  if (pathname === "/login") {
    return null;
  }

  return (
    <form
      action={logout}
      className="fixed bottom-4 right-4 z-50"
    >
      <LogoutSubmitButton />
    </form>
  );
}
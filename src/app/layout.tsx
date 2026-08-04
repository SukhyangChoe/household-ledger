import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { LogoutButton } from "@/components/logout-button";

export const metadata: Metadata = {
  title: "우리집 가계부",
  description: "생활비 계좌 중심 가계관리 프로그램",
};

const nav = [
  ["/", "홈"],
  ["/ledger", "월별 가계부"],
  ["/settlements", "생활비 정산"],
  ["/recurring", "정기 항목"],
  ["/settings", "설정"],
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <div className="min-h-screen lg:grid lg:grid-cols-[230px_1fr]">
          <aside className="hidden border-r border-[var(--border)] bg-white px-5 py-7 lg:block">
            <div className="mb-9">
              <p className="text-xs font-semibold tracking-[0.22em] text-[var(--accent)]">HOUSEHOLD</p>
              <h1 className="mt-2 text-xl font-bold">우리집 가계부</h1>
            </div>
            <nav className="space-y-1">
              {nav.map(([href, label]) => (
                <Link key={href} href={href} className="block rounded-xl px-3 py-3 text-sm font-medium hover:bg-[var(--surface-soft)]">
                  {label}
                </Link>
              ))}
            </nav>
          </aside>
          <div className="min-w-0 pb-20 lg:pb-0">
            <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[rgba(247,246,242,0.92)] px-5 backdrop-blur lg:px-8">
              <div>
                <p className="text-xs text-gray-500">결제일 기준 · 데모 모드</p>
                <p className="font-semibold">2026년 7월</p>
              </div>
              <button className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">+ 거래 추가</button>
            </header>
            <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><LogoutButton />{children}</main>
          </div>
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[var(--border)] bg-white lg:hidden">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="px-1 py-3 text-center text-[11px] font-medium">{label.replace("월별 ", "")}</Link>
          ))}
        </nav>
      </body>
    </html>
  );
}

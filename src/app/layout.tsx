import type { Metadata } from "next";
import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";

import "./globals.css";

export const metadata: Metadata = {
  title: "우리집 가계부",
  description: "생활비 계좌 중심 가계관리 프로그램",
};

const mainNav = [
  ["/", "홈"],
  ["/ledger", "월별 가계부"],
  ["/settlements", "생활비 정산"],
  ["/reconciliation", "잔액 대조"],
  ["/recurring", "정기결제"],
  ["/monthly-close", "월 마감"],
  ["/monthly-summary", "월별 정리"],
] as const;

const recurringSubNav = [
  ["/recurring/general", "일반 정기 결제"],
  ["/recurring/cards", "카드 정기 결제"],
] as const;

const settingsNav = [
  ["/settings/rates", "생활비 반영률"],
  ["/settings/accounts", "카드 · 계좌"],
  ["/settings/categories", "수입 · 지출 카테고리"],
] as const;

const mobileNav = [
  ["/", "홈"],
  ["/ledger", "가계부"],
  ["/settlements", "정산"],
  ["/reconciliation", "대조"],
  ["/recurring", "정기"],
  ["/monthly-close", "마감"],
  ["/monthly-summary", "정리"],
  ["/settings", "설정"],
] as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <div className="min-h-screen lg:grid lg:grid-cols-[230px_1fr]">
          <aside className="hidden border-r border-[var(--border)] bg-white px-5 py-7 lg:block">
            <div className="mb-9">
              <p className="text-xs font-semibold tracking-[0.22em] text-[var(--accent)]">
                HOUSEHOLD
              </p>
              <h1 className="mt-2 text-xl font-bold">
                우리집 가계부
              </h1>
            </div>

            <nav className="space-y-1">
              {mainNav.map(([href, label]) => (
                <div key={href}>
                  <Link
                    href={href}
                    className="block rounded-xl px-3 py-3 text-sm font-medium hover:bg-[var(--surface-soft)]"
                  >
                    {label}
                  </Link>

                  {href === "/recurring" ? (
                    <div className="ml-3 space-y-1 border-l border-[var(--border)] pl-3">
                      {recurringSubNav.map(([subHref, subLabel]) => (
                        <Link
                          key={subHref}
                          href={subHref}
                          className="block rounded-lg px-3 py-2 text-xs font-medium text-gray-600 hover:bg-[var(--surface-soft)] hover:text-gray-900"
                        >
                          {subLabel}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}

              <div className="pt-1">
                <Link
                  href="/settings"
                  className="block rounded-xl px-3 py-3 text-sm font-medium hover:bg-[var(--surface-soft)]"
                >
                  설정
                </Link>

                <div className="ml-3 space-y-1 border-l border-[var(--border)] pl-3">
                  {settingsNav.map(([href, label]) => (
                    <Link
                      key={href}
                      href={href}
                      className="block rounded-lg px-3 py-2 text-xs font-medium text-gray-600 hover:bg-[var(--surface-soft)] hover:text-gray-900"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </nav>
          </aside>

          <div className="min-w-0 pb-20 lg:pb-0">
            <header className="sticky top-0 z-10 flex h-16 items-center border-b border-[var(--border)] bg-[rgba(247,246,242,0.92)] px-5 backdrop-blur lg:px-8">
              <div>
                <p className="text-xs text-gray-500">
                  결제일 기준 · 실제 데이터
                </p>
                <p className="font-semibold">
                  생활비 계좌 중심 가계부
                </p>
              </div>
            </header>

            <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
              <LogoutButton />
              {children}
            </main>
          </div>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t border-[var(--border)] bg-white lg:hidden">
          {mobileNav.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="min-w-14 flex-1 px-2 py-3 text-center text-[10px] font-medium"
            >
              {label}
            </Link>
          ))}
        </nav>
      </body>
    </html>
  );
}

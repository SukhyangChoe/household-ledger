import Link from "next/link";

const recurringNav = [
  {
    href: "/recurring/general",
    label: "일반 정기 결제",
    description: "정기 수입과 계좌로 직접 나가는 정기 지출",
  },
  {
    href: "/recurring/cards",
    label: "카드 정기 결제",
    description: "카드별 결제일에 합산되는 정기 지출",
  },
] as const;

export default function RecurringLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">
          정기결제
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          저장 구조는 하나로 유지하면서 일반 정기 결제와 카드 정기 결제를 나누어 관리합니다.
        </p>
      </div>

      <nav className="grid gap-3 sm:grid-cols-2">
        {recurringNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-[var(--border)] bg-white p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <p className="font-semibold">
              {item.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              {item.description}
            </p>
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}

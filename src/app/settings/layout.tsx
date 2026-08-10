import Link from "next/link";

const settingsNav = [
  {
    href: "/settings",
    label: "설정 시작",
    description: "기본 준비 상태와 다음 설정 확인",
  },
  {
    href: "/settings/accounts",
    label: "카드 · 계좌",
    description: "계좌와 카드 결제 정보",
  },
  {
    href: "/settings/rates",
    label: "생활비 반영률",
    description: "수입별 생활비 배정 비율과 이력",
  },
  {
    href: "/settings/categories",
    label: "수입 · 지출 카테고리",
    description: "거래 입력에 사용할 기본 분류",
  },
] as const;

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">
          설정
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          처음이라면 설정 시작에서
          준비 상태를 확인하고
          순서대로 진행하세요.
        </p>
      </div>

      <nav className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {settingsNav.map((item) => (
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

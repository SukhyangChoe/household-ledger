import { Badge, Card, MoneyRow } from "@/components/ui";
import { settlementItems, won } from "@/lib/demo-data";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">이번 달 한눈에 보기</h2>
          <p className="mt-1 text-sm text-gray-500">생활비 계좌와 프로그램 잔액이 맞는지 먼저 확인합니다.</p>
        </div>
        <Badge tone="good">계좌 잔액 일치</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card title="확정 수입" value="7,000,000원" sub="남은 예정 수입 500,000원" />
        <Card title="생활비 배정" value="2,410,000원" sub="수입별 연결된 반영률 적용" />
        <Card title="생활비 사용" value="1,850,000원" sub="예산 잔액 560,000원 · 사용률 76.8%" />
        <Card title="투자 가능액" value="4,290,000원" sub="투자 목적 비용 300,000원 차감 후" />
        <Card title="고정지출 충당률" value="113.6%" sub="자산소득이 전체 고정지출보다 300,000원 많음" />
        <Card title="생활비 계좌" value="3,420,000원" sub="프로그램 장부와 실제 은행 잔액 차이 0원" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card title="이번 달 필요한 이체">
          <div className="mt-4 space-y-3">
            {settlementItems.map((item) => (
              <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4 hover:bg-[var(--surface-soft)]">
                <input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{item.title}</span>
                    <span className="font-bold">{won(item.amount)}</span>
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">{item.direction}</span>
                </span>
              </label>
            ))}
            <button className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">선택 거래 이체 완료</button>
          </div>
        </Card>

        <Card title="생활비 계좌 대조">
          <div className="mt-3 divide-y divide-[var(--border)]">
            <MoneyRow label="은행 앱 실제 잔액" value="3,420,000원" />
            <MoneyRow label="프로그램 장부 잔액" value="3,420,000원" />
            <MoneyRow label="아직 받을 금액" value="+1,410,000원" />
            <MoneyRow label="아직 보낼 금액" value="-700,000원" />
            <MoneyRow label="정산 후 목표 잔액" value="4,130,000원" strong />
          </div>
          <button className="mt-4 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold">실제 잔액 입력</button>
        </Card>
      </div>
    </div>
  );
}

import { Badge, Card } from "@/components/ui";
import { demoTransactions, won } from "@/lib/demo-data";

export default function LedgerPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">월별 가계부</h2>
        <p className="mt-1 text-sm text-gray-500">카드 사용일이 아닌 실제 결제일 기준입니다.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Card title="확정 수입" value="7,000,000원" />
        <Card title="생활비 지출" value="1,850,000원" />
        <Card title="투자 목적 비용" value="300,000원" />
        <Card title="미정산 거래" value="3건" />
      </div>
      <Card title="거래 내역">
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-[var(--border)] text-xs text-gray-500"><th className="py-3">반영일</th><th>내역</th><th>구분</th><th>금액</th><th>목적</th><th>성격</th><th>계좌</th><th>상태</th></tr></thead>
            <tbody>
              {demoTransactions.map((t) => (
                <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-4">{t.date}</td><td className="font-medium">{t.name}</td><td>{t.type}</td><td className="font-semibold">{won(t.amount)}</td><td>{t.purpose}</td><td>{t.nature}</td><td>{t.account}</td><td><Badge tone={t.status === "확정" ? "good" : "warn"}>{t.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

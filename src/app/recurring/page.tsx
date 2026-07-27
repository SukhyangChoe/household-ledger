import { Badge, Card } from "@/components/ui";
import { recurringRules, won } from "@/lib/demo-data";

export default function RecurringPage() {
  return (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-bold">정기 항목</h2><p className="mt-1 text-sm text-gray-500">정기 수입·지출·카드 결제·할부를 한 규칙으로 관리합니다.</p></div>
      <Card title="자동 생성 규칙">
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead><tr className="border-b border-[var(--border)] text-xs text-gray-500"><th className="py-3">항목</th><th>기간</th><th>반영일</th><th>금액</th><th>연결</th><th>회차</th></tr></thead>
            <tbody>{recurringRules.map((r) => <tr key={r.name} className="border-b border-[var(--border)] last:border-0"><td className="py-4 font-semibold">{r.name}</td><td>{r.period}</td><td>{r.day}</td><td>{won(r.amount)}</td><td>{r.link}</td><td>{r.progress === "-" ? <Badge>일반</Badge> : <Badge tone="warn">{r.progress}</Badge>}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

import { Card } from "@/components/ui";

const rates = [["기본 생활비 반영률", "28.2%", "2026.01.01부터"], ["전액 생활비 반영률", "100%", "2026.01.01부터"], ["전액 투자 반영률", "0%", "2026.01.01부터"]];
const accounts = [["아내 생활비 계좌", "아내", "대표 생활비 계좌"], ["남편 급여·결제 계좌", "남편", "일반 계좌"], ["아내 수입 계좌", "아내", "일반 계좌"]];

export default function SettingsPage() {
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold">설정</h2><p className="mt-1 text-sm text-gray-500">현재는 화면 검토용 데모입니다.</p></div>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="생활비 반영률"><div className="mt-3 divide-y divide-[var(--border)]">{rates.map(([name, rate, period]) => <div key={name} className="flex items-center justify-between py-4"><div><p className="font-semibold">{name}</p><p className="text-xs text-gray-500">{period}</p></div><strong>{rate}</strong></div>)}</div></Card>
      <Card title="계좌"><div className="mt-3 divide-y divide-[var(--border)]">{accounts.map(([name, owner, role]) => <div key={name} className="py-4"><p className="font-semibold">{name}</p><p className="mt-1 text-xs text-gray-500">{owner} · {role}</p></div>)}</div></Card>
    </div>
  </div>;
}

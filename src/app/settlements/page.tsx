"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { settlementItems, won } from "@/lib/demo-data";

export default function SettlementsPage() {
  const [done, setDone] = useState<string[]>([]);
  const pending = settlementItems.filter((x) => !done.includes(x.id));
  const byDirection = useMemo(() => pending.reduce<Record<string, number>>((acc, x) => { acc[x.direction] = (acc[x.direction] ?? 0) + x.amount; return acc; }, {}), [pending]);

  return (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-bold">생활비 정산</h2><p className="mt-1 text-sm text-gray-500">실제 이체 방식과 관계없이 포함된 거래만 완료 체크합니다.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(byDirection).map(([direction, amount]) => <Card key={direction} title={direction} value={won(amount)} sub="미완료 거래 합계" />)}
      </div>
      <Card title="이체가 필요한 거래">
        <div className="mt-4 space-y-3">
          {settlementItems.map((item) => {
            const checked = done.includes(item.id);
            return <label key={item.id} className={`flex items-center gap-3 rounded-xl border p-4 ${checked ? "border-emerald-200 bg-emerald-50/50" : "border-[var(--border)] bg-white"}`}>
              <input type="checkbox" checked={checked} onChange={() => setDone((prev) => checked ? prev.filter((x) => x !== item.id) : [...prev, item.id])} className="size-4 accent-[var(--accent)]" />
              <span className="flex-1"><span className="block font-semibold">{item.title}</span><span className="text-xs text-gray-500">{item.direction}</span></span>
              <strong>{won(item.amount)}</strong>
            </label>;
          })}
        </div>
      </Card>
    </div>
  );
}

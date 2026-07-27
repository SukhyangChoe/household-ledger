import type { ReactNode } from "react";

export function Card({ title, value, sub, children }: { title: string; value?: string; sub?: string; children?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[0_8px_28px_rgba(38,48,43,0.04)]">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {value && <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>}
      {sub && <p className="mt-2 text-xs leading-5 text-gray-500">{sub}</p>}
      {children}
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" }) {
  const cls = tone === "good" ? "bg-emerald-50 text-emerald-700" : tone === "warn" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function MoneyRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex items-center justify-between py-2 text-sm ${strong ? "font-bold" : ""}`}><span className="text-gray-600">{label}</span><span>{value}</span></div>;
}

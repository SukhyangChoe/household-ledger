import { AccountManager } from "@/app/settings/accounts/account-manager";
import { Card } from "@/components/ui";
import { requireCurrentHousehold } from "@/lib/household/current";

const rates = [
  [
    "기본 생활비 반영률",
    "28.2%",
    "2026.01.01부터",
  ],
  [
    "전액 생활비 반영률",
    "100%",
    "2026.01.01부터",
  ],
  [
    "전액 투자 반영률",
    "0%",
    "2026.01.01부터",
  ],
];

export default async function SettingsPage() {
  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("household_id", householdId)
    .order("is_living_account", {
      ascending: false,
    })
    .order("is_active", {
      ascending: false,
    })
    .order("name", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Failed to load accounts:",
      error.message,
    );

    throw new Error(
      "계좌 정보를 불러오지 못했습니다.",
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">설정</h2>

        <p className="mt-1 text-sm text-gray-500">
          계좌는 실제 Supabase 데이터에 저장됩니다.
          생활비 반영률은 다음 단계에서 연결합니다.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="생활비 반영률">
          <div className="mt-3 divide-y divide-[var(--border)]">
            {rates.map(([name, rate, period]) => (
              <div
                key={name}
                className="flex items-center justify-between py-4"
              >
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="text-xs text-gray-500">
                    {period}
                  </p>
                </div>

                <strong>{rate}</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card title="계좌">
          <AccountManager accounts={accounts ?? []} />
        </Card>
      </div>
    </div>
  );
}
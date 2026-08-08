import { AccountManager } from "@/app/settings/accounts/account-manager";
import { CardManager } from "@/app/settings/cards/card-manager";
import { Card } from "@/components/ui";
import { requireCurrentHousehold } from "@/lib/household/current";

export default async function AccountSettingsPage() {
  const { supabase, householdId } =
    await requireCurrentHousehold();

  const [accountsResult, cardsResult] =
    await Promise.all([
      supabase
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
        }),

      supabase
        .from("cards")
        .select("*")
        .eq("household_id", householdId)
        .order("is_active", {
          ascending: false,
        })
        .order("name", {
          ascending: true,
        }),
    ]);

  if (accountsResult.error) {
    console.error(
      "Failed to load accounts:",
      accountsResult.error.message,
    );

    throw new Error(
      "계좌 정보를 불러오지 못했습니다.",
    );
  }

  if (cardsResult.error) {
    console.error(
      "Failed to load cards:",
      cardsResult.error.message,
    );

    throw new Error(
      "카드 정보를 불러오지 못했습니다.",
    );
  }

  const accounts = accountsResult.data ?? [];
  const cards = cardsResult.data ?? [];

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="계좌">
        <AccountManager accounts={accounts} />
      </Card>

      <Card title="카드">
        <CardManager
          accounts={accounts}
          cards={cards}
        />
      </Card>
    </div>
  );
}

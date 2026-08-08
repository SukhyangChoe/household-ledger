import { CategoryManager } from "@/app/settings/categories/category-manager";
import { Card } from "@/components/ui";
import { requireCurrentHousehold } from "@/lib/household/current";

export default async function CategorySettingsPage() {
  const { supabase, householdId } =
    await requireCurrentHousehold();

  const [
    accountsResult,
    categoriesResult,
    rateRulesResult,
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("household_id", householdId)
      .order("is_active", {
        ascending: false,
      })
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("categories")
      .select("*")
      .eq("household_id", householdId)
      .order("transaction_type", {
        ascending: true,
      })
      .order("is_active", {
        ascending: false,
      })
      .order("sort_order", {
        ascending: true,
      })
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("rate_rules")
      .select("*")
      .eq("household_id", householdId)
      .order("rule_key", {
        ascending: true,
      })
      .order("valid_from", {
        ascending: false,
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

  if (categoriesResult.error) {
    console.error(
      "Failed to load categories:",
      categoriesResult.error.message,
    );

    throw new Error(
      "카테고리 정보를 불러오지 못했습니다.",
    );
  }

  if (rateRulesResult.error) {
    console.error(
      "Failed to load rate rules:",
      rateRulesResult.error.message,
    );

    throw new Error(
      "생활비 반영률을 불러오지 못했습니다.",
    );
  }

  return (
    <Card title="수입 · 지출 카테고리">
      <CategoryManager
        accounts={accountsResult.data ?? []}
        categories={categoriesResult.data ?? []}
        rateRules={rateRulesResult.data ?? []}
      />
    </Card>
  );
}

import { AccountManager } from "@/app/settings/accounts/account-manager";
import { CardManager } from "@/app/settings/cards/card-manager";
import { CategoryManager } from "@/app/settings/categories/category-manager";
import { RateRuleManager } from "@/app/settings/rates/rate-rule-manager";
import { Card } from "@/components/ui";
import { requireCurrentHousehold } from "@/lib/household/current";

function getKoreaToday() {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year",
  )?.value;

  const month = parts.find(
    (part) => part.type === "month",
  )?.value;

  const day = parts.find(
    (part) => part.type === "day",
  )?.value;

  if (!year || !month || !day) {
    throw new Error(
      "현재 날짜를 확인하지 못했습니다.",
    );
  }

  return `${year}-${month}-${day}`;
}

export default async function SettingsPage() {
  const { supabase, householdId } =
    await requireCurrentHousehold();

  const [
    accountsResult,
    cardsResult,
    rateRulesResult,
    categoriesResult,
  ] = await Promise.all([
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

  if (rateRulesResult.error) {
    console.error(
      "Failed to load rate rules:",
      rateRulesResult.error.message,
    );

    throw new Error(
      "생활비 반영률을 불러오지 못했습니다.",
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

  const accounts = accountsResult.data ?? [];
  const cards = cardsResult.data ?? [];
  const rateRules = rateRulesResult.data ?? [];
  const categories = categoriesResult.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">
          설정
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          계좌, 카드, 생활비 반영률과 카테고리는
          실제 Supabase 데이터에 저장됩니다.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="생활비 반영률">
          <RateRuleManager
            rateRules={rateRules}
            today={getKoreaToday()}
          />
        </Card>

        <Card title="계좌">
          <AccountManager accounts={accounts} />
        </Card>

        <Card title="카드">
          <CardManager
            accounts={accounts}
            cards={cards}
          />
        </Card>

        <div className="xl:col-span-2">
          <Card title="수입·지출 카테고리">
            <CategoryManager
              accounts={accounts}
              categories={categories}
              rateRules={rateRules}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

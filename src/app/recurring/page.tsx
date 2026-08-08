import { RecurringManager } from "@/app/recurring/recurring-manager";
import { Card } from "@/components/ui";
import { requireCurrentHousehold } from "@/lib/household/current";

export const dynamic = "force-dynamic";

function getCurrentMonthInKorea() {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
      },
    );

  const parts = formatter.formatToParts(
    new Date(),
  );

  const year = parts.find(
    (part) => part.type === "year",
  )?.value;
  const month = parts.find(
    (part) => part.type === "month",
  )?.value;

  if (!year || !month) {
    throw new Error(
      "현재 월을 계산하지 못했습니다.",
    );
  }

  return `${year}-${month}`;
}

export default async function RecurringPage() {
  const {
    supabase,
    householdId,
  } = await requireCurrentHousehold();

  const currentMonth =
    getCurrentMonthInKorea();
  const targetMonth =
    `${currentMonth}-01`;

  const {
    error: generationError,
  } = await supabase.rpc(
    "generate_recurring_transactions",
    {
      p_household_id: householdId,
      p_target_month: targetMonth,
    },
  );

  if (generationError) {
    console.error(
      "Failed to generate recurring transactions:",
      generationError,
    );

    throw new Error(
      "이번 달 정기 거래를 생성하지 못했습니다.",
    );
  }

  const [
    rulesResult,
    accountsResult,
    cardsResult,
    categoriesResult,
    rateRulesResult,
  ] = await Promise.all([
    supabase
      .from("recurring_rules")
      .select("*")
      .eq(
        "household_id",
        householdId,
      )
      .order("is_active", {
        ascending: false,
      })
      .order("start_month", {
        ascending: false,
      })
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("accounts")
      .select("*")
      .eq(
        "household_id",
        householdId,
      )
      .order("is_active", {
        ascending: false,
      })
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("cards")
      .select("*")
      .eq(
        "household_id",
        householdId,
      )
      .order("is_active", {
        ascending: false,
      })
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("categories")
      .select("*")
      .eq(
        "household_id",
        householdId,
      )
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
      .eq(
        "household_id",
        householdId,
      )
      .order("is_active", {
        ascending: false,
      })
      .order("valid_from", {
        ascending: false,
      }),
  ]);

  const firstError =
    rulesResult.error ??
    accountsResult.error ??
    cardsResult.error ??
    categoriesResult.error ??
    rateRulesResult.error;

  if (firstError) {
    console.error(
      "Failed to load recurring page:",
      firstError,
    );

    throw new Error(
      "정기 항목 정보를 불러오지 못했습니다.",
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">
          정기 항목
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          정기 수입·정기 지출·할부를 하나의 규칙으로 관리합니다. 종료 월이 없으면 계속 생성됩니다.
        </p>
      </div>

      <Card title="자동 생성 규칙">
        <p className="mt-2 text-sm text-gray-500">
          이번 달에 해당하는 활성 규칙은 같은 규칙·같은 월 기준으로 한 번만 예정 거래를 생성합니다.
        </p>

        <RecurringManager
          rules={
            rulesResult.data ?? []
          }
          accounts={
            accountsResult.data ?? []
          }
          cards={
            cardsResult.data ?? []
          }
          categories={
            categoriesResult.data ?? []
          }
          rateRules={
            rateRulesResult.data ?? []
          }
          currentMonth={currentMonth}
        />
      </Card>
    </div>
  );
}

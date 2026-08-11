import { RecurringManager } from "@/app/recurring/recurring-manager";
import { Card } from "@/components/ui";
import { requireCurrentHousehold } from "@/lib/household/current";

export type RecurringPageMode =
  | "general"
  | "card";

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

  const parts =
    formatter.formatToParts(
      new Date(),
    );

  const year = parts.find(
    (part) =>
      part.type === "year",
  )?.value;
  const month = parts.find(
    (part) =>
      part.type === "month",
  )?.value;

  if (!year || !month) {
    throw new Error(
      "현재 월을 계산하지 못했습니다.",
    );
  }

  return `${year}-${month}`;
}

export async function RecurringPageContent({
  mode,
}: {
  mode: RecurringPageMode;
}) {
  const {
    supabase,
    householdId,
  } =
    await requireCurrentHousehold();

  const currentMonth =
    getCurrentMonthInKorea();
  const targetMonth =
    `${currentMonth}-01`;

  const {
    error: generationError,
  } = await supabase.rpc(
    "generate_recurring_transactions",
    {
      p_household_id:
        householdId,
      p_target_month:
        targetMonth,
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

  const allRules =
    rulesResult.data ?? [];

  const rules =
    mode === "card"
      ? allRules.filter(
          (rule) =>
            rule.card_id !== null,
        )
      : allRules.filter(
          (rule) =>
            rule.card_id === null,
        );

  const title =
    mode === "card"
      ? "카드 정기 결제"
      : "일반 정기 결제";

  const description =
    mode === "card"
      ? "카드로 반복 결제되는 항목을 카드별로 관리합니다. 결제일과 실제 출금 계좌는 카드 설정값을 사용합니다."
      : "정기 수입과 계좌로 직접 입출금되는 정기 지출을 관리합니다.";

  return (
    <Card title={title}>
      <p className="mt-2 text-sm leading-6 text-gray-500">
        {description}
      </p>

      <RecurringManager
        mode={mode}
        rules={rules}
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
        currentMonth={
          currentMonth
        }
      />
    </Card>
  );
}

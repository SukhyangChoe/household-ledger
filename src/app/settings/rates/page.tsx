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

export default async function RateSettingsPage() {
  const { supabase, householdId } =
    await requireCurrentHousehold();

  const { data, error } = await supabase
    .from("rate_rules")
    .select("*")
    .eq("household_id", householdId)
    .order("rule_key", {
      ascending: true,
    })
    .order("valid_from", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Failed to load rate rules:",
      error.message,
    );

    throw new Error(
      "생활비 반영률을 불러오지 못했습니다.",
    );
  }

  return (
    <Card title="생활비 반영률">
      <RateRuleManager
        rateRules={data ?? []}
        today={getKoreaToday()}
      />
    </Card>
  );
}

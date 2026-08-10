export type SetupAccountInput = {
  is_active: boolean;
  is_living_account: boolean;
};

export type SetupRateRuleInput = {
  is_active: boolean;
  valid_from: string;
  valid_to: string | null;
};

export type SetupCategoryInput = {
  is_active: boolean;
  transaction_type: "income" | "expense" | "transfer";
};

export type SetupCardInput = {
  is_active: boolean;
};

export type SetupStepId =
  | "accounts"
  | "rates"
  | "categories";

export type SetupStep = {
  id: SetupStepId;
  complete: boolean;
  href: string;
};

export type SetupProgress = {
  steps: SetupStep[];
  completedRequiredSteps: number;
  totalRequiredSteps: number;
  ready: boolean;
  nextRequiredStep: SetupStep | null;
  activeAccountCount: number;
  hasLivingAccount: boolean;
  currentRateRuleCount: number;
  activeIncomeCategoryCount: number;
  activeExpenseCategoryCount: number;
  activeCardCount: number;
};

function isCurrentRateRule(
  rule: SetupRateRuleInput,
  today: string,
) {
  return (
    rule.is_active &&
    rule.valid_from <= today &&
    (rule.valid_to === null ||
      rule.valid_to >= today)
  );
}

export function buildSetupProgress({
  accounts,
  rateRules,
  categories,
  cards,
  today,
}: {
  accounts: SetupAccountInput[];
  rateRules: SetupRateRuleInput[];
  categories: SetupCategoryInput[];
  cards: SetupCardInput[];
  today: string;
}): SetupProgress {
  const activeAccounts =
    accounts.filter(
      (account) =>
        account.is_active,
    );

  const hasLivingAccount =
    activeAccounts.some(
      (account) =>
        account.is_living_account,
    );

  const currentRateRuleCount =
    rateRules.filter((rule) =>
      isCurrentRateRule(
        rule,
        today,
      ),
    ).length;

  const activeIncomeCategoryCount =
    categories.filter(
      (category) =>
        category.is_active &&
        category.transaction_type ===
          "income",
    ).length;

  const activeExpenseCategoryCount =
    categories.filter(
      (category) =>
        category.is_active &&
        category.transaction_type ===
          "expense",
    ).length;

  const activeCardCount =
    cards.filter(
      (card) => card.is_active,
    ).length;

  const steps: SetupStep[] = [
    {
      id: "accounts",
      complete:
        activeAccounts.length > 0 &&
        hasLivingAccount,
      href: "/settings/accounts",
    },
    {
      id: "rates",
      complete:
        currentRateRuleCount > 0,
      href: "/settings/rates",
    },
    {
      id: "categories",
      complete:
        activeIncomeCategoryCount > 0 &&
        activeExpenseCategoryCount > 0,
      href: "/settings/categories",
    },
  ];

  const completedRequiredSteps =
    steps.filter(
      (step) => step.complete,
    ).length;

  return {
    steps,
    completedRequiredSteps,
    totalRequiredSteps:
      steps.length,
    ready:
      completedRequiredSteps ===
      steps.length,
    nextRequiredStep:
      steps.find(
        (step) => !step.complete,
      ) ?? null,
    activeAccountCount:
      activeAccounts.length,
    hasLivingAccount,
    currentRateRuleCount,
    activeIncomeCategoryCount,
    activeExpenseCategoryCount,
    activeCardCount,
  };
}

export type MonthlySummarySnapshot = {
  snapshot_month: string;
  confirmed_income: number;
  living_allocated_amount: number;
  living_expense_amount: number;
  investment_expense_amount: number;
  living_fixed_expense_amount: number;
  investment_fixed_expense_amount: number;
  asset_income_amount: number;
  fixed_coverage_rate_bps: number | null;
  living_budget_balance: number;
  living_account_ledger_balance: number;
  living_account_actual_balance: number | null;
  unsettled_count: number;
};

export type YearSummary = {
  closedMonths: number;
  totalConfirmedIncome: number;
  totalLivingAllocated: number;
  totalLivingExpense: number;
  totalInvestmentExpense: number;
  totalFixedExpense: number;
  totalAssetIncome: number;
  annualFixedCoverageRateBps: number | null;
  averageLivingExpense: number;
  averageInvestmentExpense: number;
  latestLivingBudgetBalance: number | null;
  latestLedgerBalance: number | null;
  latestActualBalance: number | null;
  totalUnsettledAtClose: number;
};

export function snapshotYear(
  snapshot: MonthlySummarySnapshot,
) {
  return Number(
    snapshot.snapshot_month.slice(
      0,
      4,
    ),
  );
}

export function snapshotMonthNumber(
  snapshot: MonthlySummarySnapshot,
) {
  return Number(
    snapshot.snapshot_month.slice(
      5,
      7,
    ),
  );
}

export function sortSnapshotsAscending(
  snapshots: MonthlySummarySnapshot[],
) {
  return [...snapshots].sort(
    (a, b) =>
      a.snapshot_month.localeCompare(
        b.snapshot_month,
      ),
  );
}

export function filterSnapshotsByYear(
  snapshots: MonthlySummarySnapshot[],
  year: number,
) {
  return sortSnapshotsAscending(
    snapshots.filter(
      (snapshot) =>
        snapshotYear(snapshot) ===
        year,
    ),
  );
}

export function buildYearSummary(
  snapshots: MonthlySummarySnapshot[],
): YearSummary {
  const sorted =
    sortSnapshotsAscending(
      snapshots,
    );

  let totalConfirmedIncome = 0;
  let totalLivingAllocated = 0;
  let totalLivingExpense = 0;
  let totalInvestmentExpense = 0;
  let totalFixedExpense = 0;
  let totalAssetIncome = 0;
  let totalUnsettledAtClose = 0;

  for (const snapshot of sorted) {
    totalConfirmedIncome +=
      snapshot.confirmed_income;
    totalLivingAllocated +=
      snapshot.living_allocated_amount;
    totalLivingExpense +=
      snapshot.living_expense_amount;
    totalInvestmentExpense +=
      snapshot.investment_expense_amount;
    totalFixedExpense +=
      snapshot.living_fixed_expense_amount +
      snapshot.investment_fixed_expense_amount;
    totalAssetIncome +=
      snapshot.asset_income_amount;
    totalUnsettledAtClose +=
      snapshot.unsettled_count;
  }

  const closedMonths =
    sorted.length;

  const latest =
    sorted.at(-1) ?? null;

  return {
    closedMonths,
    totalConfirmedIncome,
    totalLivingAllocated,
    totalLivingExpense,
    totalInvestmentExpense,
    totalFixedExpense,
    totalAssetIncome,
    annualFixedCoverageRateBps:
      totalFixedExpense > 0
        ? Math.round(
            (totalAssetIncome *
              10_000) /
              totalFixedExpense,
          )
        : null,
    averageLivingExpense:
      closedMonths > 0
        ? Math.round(
            totalLivingExpense /
              closedMonths,
          )
        : 0,
    averageInvestmentExpense:
      closedMonths > 0
        ? Math.round(
            totalInvestmentExpense /
              closedMonths,
          )
        : 0,
    latestLivingBudgetBalance:
      latest?.living_budget_balance ??
      null,
    latestLedgerBalance:
      latest?.living_account_ledger_balance ??
      null,
    latestActualBalance:
      latest?.living_account_actual_balance ??
      null,
    totalUnsettledAtClose,
  };
}

export function latestTwoSnapshots(
  snapshots: MonthlySummarySnapshot[],
) {
  const sorted =
    sortSnapshotsAscending(
      snapshots,
    );

  return {
    latest:
      sorted.at(-1) ?? null,
    previous:
      sorted.at(-2) ?? null,
  };
}

export function amountChange(
  latest: number,
  previous: number,
) {
  return latest - previous;
}

export function maxTrendValue(
  snapshots: MonthlySummarySnapshot[],
) {
  return Math.max(
    1,
    ...snapshots.flatMap(
      (snapshot) => [
        snapshot.confirmed_income,
        snapshot.living_allocated_amount,
        snapshot.living_expense_amount,
        snapshot.investment_expense_amount,
      ],
    ),
  );
}

export function trendWidthPercent(
  value: number,
  maxValue: number,
) {
  if (
    value <= 0 ||
    maxValue <= 0
  ) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      2,
      (value / maxValue) * 100,
    ),
  );
}

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  amountChange,
  buildYearSummary,
  filterSnapshotsByYear,
  latestTwoSnapshots,
  maxTrendValue,
  trendWidthPercent,
  type MonthlySummarySnapshot,
} from "@/domain/monthly-summary";

function snapshot(
  month: string,
  overrides: Partial<MonthlySummarySnapshot> = {},
): MonthlySummarySnapshot {
  return {
    snapshot_month:
      `${month}-01`,
    confirmed_income:
      5_000_000,
    living_allocated_amount:
      1_500_000,
    living_expense_amount:
      1_000_000,
    investment_expense_amount:
      500_000,
    living_fixed_expense_amount:
      600_000,
    investment_fixed_expense_amount:
      200_000,
    asset_income_amount:
      400_000,
    fixed_coverage_rate_bps:
      5000,
    living_budget_balance:
      500_000,
    living_account_ledger_balance:
      2_000_000,
    living_account_actual_balance:
      null,
    unsettled_count: 1,
    ...overrides,
  };
}

describe("monthly summary", () => {
  it("filters and sorts snapshots for the selected year", () => {
    const result =
      filterSnapshotsByYear(
        [
          snapshot("2026-03"),
          snapshot("2025-12"),
          snapshot("2026-01"),
        ],
        2026,
      );

    expect(
      result.map(
        (item) =>
          item.snapshot_month,
      ),
    ).toEqual([
      "2026-01-01",
      "2026-03-01",
    ]);
  });

  it("builds annual totals and weighted fixed coverage", () => {
    const result =
      buildYearSummary([
        snapshot("2026-01", {
          confirmed_income:
            4_000_000,
          living_expense_amount:
            900_000,
          investment_expense_amount:
            300_000,
          living_fixed_expense_amount:
            500_000,
          investment_fixed_expense_amount:
            100_000,
          asset_income_amount:
            300_000,
          unsettled_count: 2,
        }),
        snapshot("2026-02", {
          confirmed_income:
            6_000_000,
          living_expense_amount:
            1_100_000,
          investment_expense_amount:
            700_000,
          living_fixed_expense_amount:
            700_000,
          investment_fixed_expense_amount:
            300_000,
          asset_income_amount:
            500_000,
          living_budget_balance:
            400_000,
          living_account_ledger_balance:
            2_300_000,
          living_account_actual_balance:
            2_290_000,
          unsettled_count: 1,
        }),
      ]);

    expect(
      result.closedMonths,
    ).toBe(2);
    expect(
      result.totalConfirmedIncome,
    ).toBe(10_000_000);
    expect(
      result.totalLivingExpense,
    ).toBe(2_000_000);
    expect(
      result.totalInvestmentExpense,
    ).toBe(1_000_000);
    expect(
      result.totalFixedExpense,
    ).toBe(1_600_000);
    expect(
      result.totalAssetIncome,
    ).toBe(800_000);
    expect(
      result.annualFixedCoverageRateBps,
    ).toBe(5000);
    expect(
      result.averageLivingExpense,
    ).toBe(1_000_000);
    expect(
      result.latestLivingBudgetBalance,
    ).toBe(400_000);
    expect(
      result.latestActualBalance,
    ).toBe(2_290_000);
    expect(
      result.totalUnsettledAtClose,
    ).toBe(3);
  });

  it("returns the latest two snapshots in chronological order", () => {
    const result =
      latestTwoSnapshots([
        snapshot("2026-03"),
        snapshot("2026-01"),
        snapshot("2026-02"),
      ]);

    expect(
      result.latest?.snapshot_month,
    ).toBe("2026-03-01");
    expect(
      result.previous
        ?.snapshot_month,
    ).toBe("2026-02-01");
  });

  it("calculates amount changes", () => {
    expect(
      amountChange(
        1_200_000,
        1_000_000,
      ),
    ).toBe(200_000);
  });

  it("scales trend widths against the largest metric", () => {
    const items = [
      snapshot("2026-01", {
        confirmed_income:
          4_000_000,
      }),
      snapshot("2026-02", {
        confirmed_income:
          8_000_000,
      }),
    ];

    const max =
      maxTrendValue(items);

    expect(max).toBe(
      8_000_000,
    );
    expect(
      trendWidthPercent(
        4_000_000,
        max,
      ),
    ).toBe(50);
    expect(
      trendWidthPercent(
        8_000_000,
        max,
      ),
    ).toBe(100);
  });
});

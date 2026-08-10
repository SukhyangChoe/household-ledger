import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildMonthlySnapshotValues,
  monthEndDate,
  type MonthlyCloseTransactionInput,
} from "@/domain/monthly-close";

function transaction(
  overrides: Partial<MonthlyCloseTransactionInput>,
): MonthlyCloseTransactionInput {
  return {
    transaction_type: "expense",
    amount: 0,
    status: "confirmed",
    fund_purpose: "living",
    expense_nature: "variable",
    living_allocated_amount: null,
    is_asset_income_snapshot: null,
    ...overrides,
  };
}

describe("monthly close", () => {
  it("calculates the last date of a month", () => {
    expect(
      monthEndDate("2026-02"),
    ).toBe("2026-02-28");

    expect(
      monthEndDate("2028-02"),
    ).toBe("2028-02-29");
  });

  it("builds the monthly snapshot from confirmed transactions", () => {
    const snapshot =
      buildMonthlySnapshotValues({
        transactions: [
          transaction({
            transaction_type:
              "income",
            amount: 5_000_000,
            fund_purpose: null,
            expense_nature: null,
            living_allocated_amount:
              1_500_000,
            is_asset_income_snapshot:
              false,
          }),
          transaction({
            transaction_type:
              "income",
            amount: 500_000,
            fund_purpose: null,
            expense_nature: null,
            living_allocated_amount:
              100_000,
            is_asset_income_snapshot:
              true,
          }),
          transaction({
            amount: 600_000,
            fund_purpose: "living",
            expense_nature: "fixed",
          }),
          transaction({
            amount: 300_000,
            fund_purpose:
              "investment",
            expense_nature: "fixed",
          }),
          transaction({
            amount: 200_000,
            fund_purpose: "living",
            expense_nature:
              "variable",
          }),
        ],
        livingAccountLedgerBalance:
          2_100_000,
        livingAccountActualBalance:
          2_090_000,
        unsettledCount: 2,
      });

    expect(snapshot).toEqual({
      confirmed_income:
        5_500_000,
      living_allocated_amount:
        1_600_000,
      living_expense_amount:
        800_000,
      investment_expense_amount:
        300_000,
      living_fixed_expense_amount:
        600_000,
      investment_fixed_expense_amount:
        300_000,
      asset_income_amount:
        500_000,
      fixed_coverage_rate_bps:
        5556,
      living_budget_balance:
        800_000,
      living_account_ledger_balance:
        2_100_000,
      living_account_actual_balance:
        2_090_000,
      unsettled_count: 2,
    });
  });

  it("ignores planned expenses in snapshot totals", () => {
    const snapshot =
      buildMonthlySnapshotValues({
        transactions: [
          transaction({
            amount: 700_000,
            status: "planned",
            fund_purpose: "living",
            expense_nature: "fixed",
          }),
        ],
        livingAccountLedgerBalance:
          1_000_000,
        livingAccountActualBalance:
          null,
        unsettledCount: 0,
      });

    expect(
      snapshot.living_expense_amount,
    ).toBe(0);
    expect(
      snapshot.living_fixed_expense_amount,
    ).toBe(0);
  });
});

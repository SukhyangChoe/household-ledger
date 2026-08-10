import {
    describe,
    expect,
    it,
  } from "vitest";
  
  import {
    buildDashboardSummary,
    type DashboardTransactionInput,
  } from "@/domain/dashboard";
  
  function transaction(
    overrides: Partial<DashboardTransactionInput>,
  ): DashboardTransactionInput {
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
  
  describe("dashboard summary", () => {
    it("aggregates confirmed income, living allocation, and expenses", () => {
      const summary = buildDashboardSummary([
        transaction({
          transaction_type: "income",
          amount: 5_000_000,
          living_allocated_amount: 1_500_000,
          fund_purpose: null,
          expense_nature: null,
          is_asset_income_snapshot: false,
        }),
        transaction({
          amount: 700_000,
          fund_purpose: "living",
        }),
        transaction({
          amount: 300_000,
          fund_purpose: "investment",
        }),
      ]);
  
      expect(summary.confirmedIncome).toBe(5_000_000);
      expect(summary.livingAllocatedAmount).toBe(1_500_000);
      expect(summary.livingExpenseAmount).toBe(700_000);
      expect(summary.investmentExpenseAmount).toBe(300_000);
      expect(summary.livingBudgetBalance).toBe(800_000);
      expect(summary.investmentAvailableAmount).toBe(3_200_000);
    });
  
    it("counts planned income separately from confirmed income", () => {
      const summary = buildDashboardSummary([
        transaction({
          transaction_type: "income",
          amount: 1_000_000,
          status: "planned",
          fund_purpose: null,
          expense_nature: null,
          living_allocated_amount: 500_000,
          is_asset_income_snapshot: false,
        }),
      ]);
  
      expect(summary.plannedIncome).toBe(1_000_000);
      expect(summary.confirmedIncome).toBe(0);
      expect(summary.livingAllocatedAmount).toBe(0);
    });
  
    it("calculates living usage and fixed expense coverage", () => {
      const summary = buildDashboardSummary([
        transaction({
          transaction_type: "income",
          amount: 2_500_000,
          fund_purpose: null,
          expense_nature: null,
          living_allocated_amount: 1_000_000,
          is_asset_income_snapshot: true,
        }),
        transaction({
          amount: 600_000,
          fund_purpose: "living",
          expense_nature: "fixed",
        }),
        transaction({
          amount: 400_000,
          fund_purpose: "investment",
          expense_nature: "fixed",
        }),
      ]);
  
      expect(summary.livingUsageRateBps).toBe(6000);
      expect(summary.fixedExpenseAmount).toBe(1_000_000);
      expect(summary.assetIncomeAmount).toBe(2_500_000);
      expect(summary.fixedCoverageRateBps).toBe(25_000);
      expect(summary.fixedCoverageDifference).toBe(1_500_000);
    });
  
    it("returns null percentage values when the denominator is zero", () => {
      const summary = buildDashboardSummary([]);
  
      expect(summary.livingUsageRateBps).toBeNull();
      expect(summary.fixedCoverageRateBps).toBeNull();
    });
  });
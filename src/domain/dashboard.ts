export type DashboardTransactionInput = {
    transaction_type: "income" | "expense" | "transfer";
    amount: number;
    status: "planned" | "confirmed" | "cancelled";
    fund_purpose: "living" | "investment" | null;
    expense_nature: "fixed" | "variable" | "irregular" | null;
    living_allocated_amount: number | null;
    is_asset_income_snapshot: boolean | null;
  };
  
  export type DashboardSummary = {
    confirmedIncome: number;
    plannedIncome: number;
    livingAllocatedAmount: number;
    livingExpenseAmount: number;
    investmentExpenseAmount: number;
    investmentAvailableAmount: number;
    livingBudgetBalance: number;
    livingUsageRateBps: number | null;
    fixedExpenseAmount: number;
    assetIncomeAmount: number;
    fixedCoverageRateBps: number | null;
    fixedCoverageDifference: number;
  };
  
  export function buildDashboardSummary(
    transactions: DashboardTransactionInput[],
  ): DashboardSummary {
    let confirmedIncome = 0;
    let plannedIncome = 0;
    let livingAllocatedAmount = 0;
    let livingExpenseAmount = 0;
    let investmentExpenseAmount = 0;
    let fixedExpenseAmount = 0;
    let assetIncomeAmount = 0;
  
    for (const transaction of transactions) {
      if (transaction.status === "planned") {
        if (transaction.transaction_type === "income") {
          plannedIncome += transaction.amount;
        }
        continue;
      }
  
      if (transaction.status !== "confirmed") {
        continue;
      }
  
      if (transaction.transaction_type === "income") {
        confirmedIncome += transaction.amount;
        livingAllocatedAmount +=
          transaction.living_allocated_amount ?? 0;
  
        if (transaction.is_asset_income_snapshot === true) {
          assetIncomeAmount += transaction.amount;
        }
        continue;
      }
  
      if (transaction.transaction_type !== "expense") {
        continue;
      }
  
      if (transaction.fund_purpose === "living") {
        livingExpenseAmount += transaction.amount;
      } else if (transaction.fund_purpose === "investment") {
        investmentExpenseAmount += transaction.amount;
      }
  
      if (transaction.expense_nature === "fixed") {
        fixedExpenseAmount += transaction.amount;
      }
    }
  
    const investmentAvailableAmount =
      confirmedIncome -
      livingAllocatedAmount -
      investmentExpenseAmount;
  
    const livingBudgetBalance =
      livingAllocatedAmount - livingExpenseAmount;
  
    const livingUsageRateBps =
      livingAllocatedAmount > 0
        ? Math.round(
            (livingExpenseAmount * 10_000) /
              livingAllocatedAmount,
          )
        : null;
  
    const fixedCoverageRateBps =
      fixedExpenseAmount > 0
        ? Math.round(
            (assetIncomeAmount * 10_000) /
              fixedExpenseAmount,
          )
        : null;
  
    return {
      confirmedIncome,
      plannedIncome,
      livingAllocatedAmount,
      livingExpenseAmount,
      investmentExpenseAmount,
      investmentAvailableAmount,
      livingBudgetBalance,
      livingUsageRateBps,
      fixedExpenseAmount,
      assetIncomeAmount,
      fixedCoverageRateBps,
      fixedCoverageDifference:
        assetIncomeAmount - fixedExpenseAmount,
    };
  }
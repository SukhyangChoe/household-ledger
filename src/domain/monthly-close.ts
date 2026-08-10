import {
  buildDashboardSummary,
  type DashboardTransactionInput,
} from "@/domain/dashboard";

export type MonthlyCloseTransactionInput =
  DashboardTransactionInput & {
    expense_nature:
      | "fixed"
      | "variable"
      | "irregular"
      | null;
  };

export type MonthlySnapshotValues = {
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

export function monthEndDate(
  month: string,
) {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(
      month,
    )
  ) {
    throw new Error(
      "month must use YYYY-MM format",
    );
  }

  const [year, monthNumber] =
    month.split("-").map(Number);

  const lastDay = new Date(
    Date.UTC(
      year,
      monthNumber,
      0,
    ),
  ).getUTCDate();

  return `${month}-${String(
    lastDay,
  ).padStart(2, "0")}`;
}

export function buildMonthlySnapshotValues({
  transactions,
  livingAccountLedgerBalance,
  livingAccountActualBalance,
  unsettledCount,
}: {
  transactions: MonthlyCloseTransactionInput[];
  livingAccountLedgerBalance: number;
  livingAccountActualBalance: number | null;
  unsettledCount: number;
}): MonthlySnapshotValues {
  if (
    !Number.isInteger(unsettledCount) ||
    unsettledCount < 0
  ) {
    throw new Error(
      "unsettledCount must be a non-negative integer",
    );
  }

  const summary =
    buildDashboardSummary(
      transactions,
    );

  let livingFixedExpenseAmount =
    0;
  let investmentFixedExpenseAmount =
    0;

  for (const transaction of transactions) {
    if (
      transaction.status !==
        "confirmed" ||
      transaction.transaction_type !==
        "expense" ||
      transaction.expense_nature !==
        "fixed"
    ) {
      continue;
    }

    if (
      transaction.fund_purpose ===
      "living"
    ) {
      livingFixedExpenseAmount +=
        transaction.amount;
    } else if (
      transaction.fund_purpose ===
      "investment"
    ) {
      investmentFixedExpenseAmount +=
        transaction.amount;
    }
  }

  return {
    confirmed_income:
      summary.confirmedIncome,
    living_allocated_amount:
      summary.livingAllocatedAmount,
    living_expense_amount:
      summary.livingExpenseAmount,
    investment_expense_amount:
      summary.investmentExpenseAmount,
    living_fixed_expense_amount:
      livingFixedExpenseAmount,
    investment_fixed_expense_amount:
      investmentFixedExpenseAmount,
    asset_income_amount:
      summary.assetIncomeAmount,
    fixed_coverage_rate_bps:
      summary.fixedCoverageRateBps,
    living_budget_balance:
      summary.livingBudgetBalance,
    living_account_ledger_balance:
      livingAccountLedgerBalance,
    living_account_actual_balance:
      livingAccountActualBalance,
    unsettled_count:
      unsettledCount,
  };
}

export type ExpenseSummaryGroup =
  | "monthly"
  | "annual"
  | "variable"
  | "repayment_saving";

export type CardGroupingTransaction = {
  id: string;
  cardId: string;
  amount: number;
  status: "planned" | "confirmed";
  expenseSummaryGroup: ExpenseSummaryGroup | null;
};

export type CardTransactionGroup = {
  cardId: string;
  transactionIds: string[];
  count: number;
  plannedCount: number;
  confirmedCount: number;
  totalAmount: number;
  amountsBySummaryGroup: Record<ExpenseSummaryGroup, number>;
  unclassifiedAmount: number;
};

const emptyAmounts = (): Record<ExpenseSummaryGroup, number> => ({
  monthly: 0,
  annual: 0,
  variable: 0,
  repayment_saving: 0,
});

export function groupCardTransactions(
  transactions: CardGroupingTransaction[],
): CardTransactionGroup[] {
  const groups = new Map<string, CardTransactionGroup>();

  for (const transaction of transactions) {
    const existing =
      groups.get(transaction.cardId) ?? {
        cardId: transaction.cardId,
        transactionIds: [],
        count: 0,
        plannedCount: 0,
        confirmedCount: 0,
        totalAmount: 0,
        amountsBySummaryGroup: emptyAmounts(),
        unclassifiedAmount: 0,
      };

    existing.transactionIds.push(transaction.id);
    existing.count += 1;
    existing.totalAmount += transaction.amount;

    if (transaction.status === "planned") {
      existing.plannedCount += 1;
    } else {
      existing.confirmedCount += 1;
    }

    if (transaction.expenseSummaryGroup) {
      existing.amountsBySummaryGroup[
        transaction.expenseSummaryGroup
      ] += transaction.amount;
    } else {
      existing.unclassifiedAmount += transaction.amount;
    }

    groups.set(transaction.cardId, existing);
  }

  return [...groups.values()];
}

export type TransactionForSettlement = {
  transactionType: "income" | "expense" | "transfer";
  amount: number;
  accountId: string | null;
  status: "planned" | "confirmed" | "cancelled";
  livingAllocatedAmount?: number | null;
  fundPurpose?: "living" | "investment" | null;
  settlementCompletedAt?: string | null;
};

export type SettlementInstruction = {
  direction: "account_to_living" | "living_to_investment" | "living_to_account" | "investment_to_living";
  amount: number;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
} | null;

export function getSettlementInstruction(tx: TransactionForSettlement, livingAccountId: string): SettlementInstruction {
  if (tx.status !== "confirmed" || tx.settlementCompletedAt || tx.transactionType === "transfer") return null;

  if (tx.transactionType === "income") {
    const livingAmount = tx.livingAllocatedAmount ?? 0;
    if (tx.accountId === livingAccountId) {
      const investmentAmount = tx.amount - livingAmount;
      return investmentAmount > 0 ? { direction: "living_to_investment", amount: investmentAmount, sourceAccountId: livingAccountId, destinationAccountId: null } : null;
    }
    return livingAmount > 0 ? { direction: "account_to_living", amount: livingAmount, sourceAccountId: tx.accountId, destinationAccountId: livingAccountId } : null;
  }

  if (tx.fundPurpose === "living" && tx.accountId !== livingAccountId) {
    return { direction: "living_to_account", amount: tx.amount, sourceAccountId: livingAccountId, destinationAccountId: tx.accountId };
  }
  if (tx.fundPurpose === "investment" && tx.accountId === livingAccountId) {
    return { direction: "investment_to_living", amount: tx.amount, sourceAccountId: null, destinationAccountId: livingAccountId };
  }
  return null;
}

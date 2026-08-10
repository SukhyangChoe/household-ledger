import {
  getSettlementInstruction,
  isSettlementIntoLivingAccount,
  isSettlementOutOfLivingAccount,
} from "@/domain/settlement";

export type ReconciliationTransactionInput = {
  effective_date: string;
  transaction_type: "income" | "expense" | "transfer";
  amount: number;
  status: "planned" | "confirmed" | "cancelled";
  account_id: string | null;
  fund_purpose: "living" | "investment" | null;
  living_allocated_amount: number | null;
  settlement_completed_at: string | null;
};

export type ReconciliationCalculationInput = {
  baselineActualBalance: number;
  baselineDate: string;
  targetDate: string;
  livingAccountId: string;
  transactions: ReconciliationTransactionInput[];
};

function koreaDateFromTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("settlement timestamp is invalid");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

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
      "settlement timestamp date could not be resolved",
    );
  }

  return `${year}-${month}-${day}`;
}

function directLivingAccountMovement(
  transaction: ReconciliationTransactionInput,
  livingAccountId: string,
) {
  if (
    transaction.status !== "confirmed" ||
    transaction.account_id !== livingAccountId
  ) {
    return 0;
  }

  if (transaction.transaction_type === "income") {
    return transaction.amount;
  }

  if (transaction.transaction_type === "expense") {
    return -transaction.amount;
  }

  return 0;
}

function completedSettlementMovement(
  transaction: ReconciliationTransactionInput,
  livingAccountId: string,
) {
  if (
    transaction.status !== "confirmed" ||
    !transaction.settlement_completed_at
  ) {
    return 0;
  }

  const instruction = getSettlementInstruction(
    {
      transactionType: transaction.transaction_type,
      amount: transaction.amount,
      accountId: transaction.account_id,
      status: transaction.status,
      livingAllocatedAmount:
        transaction.living_allocated_amount,
      fundPurpose: transaction.fund_purpose,
      settlementCompletedAt: null,
    },
    livingAccountId,
  );

  if (!instruction) {
    return 0;
  }

  if (
    isSettlementIntoLivingAccount(
      instruction.direction,
    )
  ) {
    return instruction.amount;
  }

  if (
    isSettlementOutOfLivingAccount(
      instruction.direction,
    )
  ) {
    return -instruction.amount;
  }

  return 0;
}

export function calculateLivingAccountLedgerBalance({
  baselineActualBalance,
  baselineDate,
  targetDate,
  livingAccountId,
  transactions,
}: ReconciliationCalculationInput) {
  if (targetDate < baselineDate) {
    throw new Error(
      "targetDate must not be before baselineDate",
    );
  }

  let balance = baselineActualBalance;

  for (const transaction of transactions) {
    if (
      transaction.effective_date > baselineDate &&
      transaction.effective_date <= targetDate
    ) {
      balance += directLivingAccountMovement(
        transaction,
        livingAccountId,
      );
    }

    if (transaction.settlement_completed_at) {
      const settlementDate =
        koreaDateFromTimestamp(
          transaction.settlement_completed_at,
        );

      if (
        settlementDate > baselineDate &&
        settlementDate <= targetDate
      ) {
        balance += completedSettlementMovement(
          transaction,
          livingAccountId,
        );
      }
    }
  }

  return balance;
}

export function reconciliationDifference(
  actualBalance: number,
  ledgerBalance: number,
) {
  return actualBalance - ledgerBalance;
}

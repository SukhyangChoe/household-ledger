export type TransactionForSettlement = {
  transactionType: "income" | "expense" | "transfer";
  amount: number;
  accountId: string | null;
  status: "planned" | "confirmed" | "cancelled";
  livingAllocatedAmount?: number | null;
  fundPurpose?: "living" | "investment" | null;
  settlementCompletedAt?: string | null;
};

export type SettlementDirection =
  | "account_to_living"
  | "living_to_investment"
  | "living_to_account"
  | "investment_to_living";

export type SettlementInstruction =
  | {
      direction: SettlementDirection;
      amount: number;
      sourceAccountId: string | null;
      destinationAccountId: string | null;
    }
  | null;

export function getSettlementInstruction(
  tx: TransactionForSettlement,
  livingAccountId: string,
): SettlementInstruction {
  if (
    tx.status !== "confirmed" ||
    tx.settlementCompletedAt ||
    tx.transactionType === "transfer"
  ) {
    return null;
  }

  if (tx.transactionType === "income") {
    const livingAmount = tx.livingAllocatedAmount ?? 0;

    if (tx.accountId === livingAccountId) {
      const investmentAmount = tx.amount - livingAmount;

      return investmentAmount > 0
        ? {
            direction: "living_to_investment",
            amount: investmentAmount,
            sourceAccountId: livingAccountId,
            destinationAccountId: null,
          }
        : null;
    }

    return livingAmount > 0
      ? {
          direction: "account_to_living",
          amount: livingAmount,
          sourceAccountId: tx.accountId,
          destinationAccountId: livingAccountId,
        }
      : null;
  }

  if (
    tx.fundPurpose === "living" &&
    tx.accountId !== livingAccountId
  ) {
    return {
      direction: "living_to_account",
      amount: tx.amount,
      sourceAccountId: livingAccountId,
      destinationAccountId: tx.accountId,
    };
  }

  if (
    tx.fundPurpose === "investment" &&
    tx.accountId === livingAccountId
  ) {
    return {
      direction: "investment_to_living",
      amount: tx.amount,
      sourceAccountId: null,
      destinationAccountId: livingAccountId,
    };
  }

  return null;
}

export type SettlementAccountInput = {
  id: string;
  name: string;
  is_living_account: boolean;
};

export type SettlementTransactionInput = {
  id: string;
  effective_date: string;
  transaction_type: "income" | "expense" | "transfer";
  name: string;
  amount: number;
  status: "planned" | "confirmed" | "cancelled";
  account_id: string | null;
  fund_purpose: "living" | "investment" | null;
  living_allocated_amount: number | null;
  settlement_completed_at: string | null;
};

export type SettlementItem = {
  transactionId: string;
  effectiveDate: string;
  name: string;
  amount: number;
  direction: SettlementDirection;
  directionText: string;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  completedAt: string | null;
};

export type SettlementBuildResult = {
  livingAccount: SettlementAccountInput | null;
  items: SettlementItem[];
};

function directionTextForInstruction({
  instruction,
  transactionAccountName,
  livingAccountName,
}: {
  instruction: Exclude<SettlementInstruction, null>;
  transactionAccountName: string | null;
  livingAccountName: string;
}) {
  switch (instruction.direction) {
    case "account_to_living":
      return `${transactionAccountName ?? "연결 계좌"} → ${livingAccountName}`;
    case "living_to_account":
      return `${livingAccountName} → ${transactionAccountName ?? "연결 계좌"}`;
    case "living_to_investment":
      return `${livingAccountName} → 투자 자금`;
    case "investment_to_living":
      return `투자 자금 → ${livingAccountName}`;
  }
}

export function buildSettlementItems(
  transactions: SettlementTransactionInput[],
  accounts: SettlementAccountInput[],
): SettlementBuildResult {
  const livingAccount =
    accounts.find((account) => account.is_living_account) ??
    null;

  if (!livingAccount) {
    return {
      livingAccount: null,
      items: [],
    };
  }

  const accountMap = new Map(
    accounts.map((account) => [account.id, account]),
  );

  const items: SettlementItem[] = [];

  for (const transaction of transactions) {
    const instruction = getSettlementInstruction(
      {
        transactionType: transaction.transaction_type,
        amount: transaction.amount,
        accountId: transaction.account_id,
        status: transaction.status,
        livingAllocatedAmount:
          transaction.living_allocated_amount,
        fundPurpose: transaction.fund_purpose,
        // 완료 거래도 화면에서 다시 열 수 있어야 하므로
        // 정산 필요 여부 계산 자체는 완료 전 상태로 평가한다.
        settlementCompletedAt: null,
      },
      livingAccount.id,
    );

    if (!instruction) {
      continue;
    }

    const transactionAccount = transaction.account_id
      ? accountMap.get(transaction.account_id) ?? null
      : null;

    items.push({
      transactionId: transaction.id,
      effectiveDate: transaction.effective_date,
      name: transaction.name,
      amount: instruction.amount,
      direction: instruction.direction,
      directionText: directionTextForInstruction({
        instruction,
        transactionAccountName:
          transactionAccount?.name ?? null,
        livingAccountName: livingAccount.name,
      }),
      sourceAccountId: instruction.sourceAccountId,
      destinationAccountId: instruction.destinationAccountId,
      completedAt: transaction.settlement_completed_at,
    });
  }

  items.sort((a, b) => {
    const dateCompare = a.effectiveDate.localeCompare(
      b.effectiveDate,
    );

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return a.name.localeCompare(b.name, "ko-KR");
  });

  return {
    livingAccount,
    items,
  };
}

export function isSettlementIntoLivingAccount(
  direction: SettlementDirection,
) {
  return (
    direction === "account_to_living" ||
    direction === "investment_to_living"
  );
}

export function isSettlementOutOfLivingAccount(
  direction: SettlementDirection,
) {
  return (
    direction === "living_to_account" ||
    direction === "living_to_investment"
  );
}
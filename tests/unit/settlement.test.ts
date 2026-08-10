import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildSettlementItems,
  getSettlementInstruction,
  isSettlementIntoLivingAccount,
  isSettlementOutOfLivingAccount,
  type SettlementAccountInput,
  type SettlementTransactionInput,
} from "@/domain/settlement";

const living = "living";

const accounts: SettlementAccountInput[] = [
  {
    id: living,
    name: "생활비 계좌",
    is_living_account: true,
  },
  {
    id: "husband",
    name: "남편 계좌",
    is_living_account: false,
  },
  {
    id: "wife",
    name: "아내 계좌",
    is_living_account: false,
  },
];

function transaction(
  overrides: Partial<SettlementTransactionInput>,
): SettlementTransactionInput {
  return {
    id: "transaction-1",
    effective_date: "2026-08-10",
    transaction_type: "income",
    name: "거래",
    amount: 1_000_000,
    status: "confirmed",
    account_id: "husband",
    fund_purpose: null,
    living_allocated_amount: 300_000,
    settlement_completed_at: null,
    ...overrides,
  };
}

describe("settlement rules", () => {
  it("moves allocated income into living account", () => {
    expect(
      getSettlementInstruction(
        {
          transactionType: "income",
          amount: 5_000_000,
          accountId: "husband",
          status: "confirmed",
          livingAllocatedAmount: 1_410_000,
        },
        living,
      )?.amount,
    ).toBe(1_410_000);
  });

  it("moves investment share out when income lands in living account", () => {
    expect(
      getSettlementInstruction(
        {
          transactionType: "income",
          amount: 5_000_000,
          accountId: living,
          status: "confirmed",
          livingAllocatedAmount: 1_410_000,
        },
        living,
      ),
    ).toMatchObject({
      direction: "living_to_investment",
      amount: 3_590_000,
    });
  });

  it("reimburses living expense paid by another account", () => {
    expect(
      getSettlementInstruction(
        {
          transactionType: "expense",
          amount: 700_000,
          accountId: "husband",
          status: "confirmed",
          fundPurpose: "living",
        },
        living,
      )?.direction,
    ).toBe("living_to_account");
  });

  it("reimburses living account for investment expense", () => {
    expect(
      getSettlementInstruction(
        {
          transactionType: "expense",
          amount: 30_000,
          accountId: living,
          status: "confirmed",
          fundPurpose: "investment",
        },
        living,
      )?.direction,
    ).toBe("investment_to_living");
  });

  it("does not settle planned, cancelled, transfer, or completed transactions", () => {
    expect(
      getSettlementInstruction(
        {
          transactionType: "income",
          amount: 100_000,
          accountId: "husband",
          status: "planned",
          livingAllocatedAmount: 50_000,
        },
        living,
      ),
    ).toBeNull();

    expect(
      getSettlementInstruction(
        {
          transactionType: "income",
          amount: 100_000,
          accountId: "husband",
          status: "confirmed",
          livingAllocatedAmount: 50_000,
          settlementCompletedAt:
            "2026-08-10T00:00:00.000Z",
        },
        living,
      ),
    ).toBeNull();
  });
});

describe("settlement page items", () => {
  it("builds account to living settlement items", () => {
    const result = buildSettlementItems(
      [transaction({ name: "남편 월급" })],
      accounts,
    );

    expect(result.items[0]).toMatchObject({
      name: "남편 월급",
      amount: 300_000,
      direction: "account_to_living",
      directionText: "남편 계좌 → 생활비 계좌",
    });
  });

  it("keeps the existing living to investment income rule", () => {
    const result = buildSettlementItems(
      [
        transaction({
          account_id: living,
          amount: 1_000_000,
          living_allocated_amount: 300_000,
        }),
      ],
      accounts,
    );

    expect(result.items[0]).toMatchObject({
      amount: 700_000,
      direction: "living_to_investment",
      directionText: "생활비 계좌 → 투자 자금",
    });
  });

  it("builds living expense reimbursement items", () => {
    const result = buildSettlementItems(
      [
        transaction({
          transaction_type: "expense",
          name: "식비",
          amount: 120_000,
          account_id: "wife",
          fund_purpose: "living",
          living_allocated_amount: null,
        }),
      ],
      accounts,
    );

    expect(result.items[0]).toMatchObject({
      name: "식비",
      amount: 120_000,
      direction: "living_to_account",
      directionText: "생활비 계좌 → 아내 계좌",
    });
  });

  it("keeps the existing investment to living expense rule", () => {
    const result = buildSettlementItems(
      [
        transaction({
          transaction_type: "expense",
          name: "투자비",
          amount: 30_000,
          account_id: living,
          fund_purpose: "investment",
          living_allocated_amount: null,
        }),
      ],
      accounts,
    );

    expect(result.items[0]).toMatchObject({
      direction: "investment_to_living",
      directionText: "투자 자금 → 생활비 계좌",
    });
  });

  it("preserves completion state for settlement history", () => {
    const completedAt = "2026-08-11T01:00:00.000Z";
    const result = buildSettlementItems(
      [
        transaction({
          settlement_completed_at: completedAt,
        }),
      ],
      accounts,
    );

    expect(result.items[0].completedAt).toBe(completedAt);
  });

  it("returns no items when a living account has not been designated", () => {
    const result = buildSettlementItems(
      [transaction({})],
      accounts.map((account) => ({
        ...account,
        is_living_account: false,
      })),
    );

    expect(result.livingAccount).toBeNull();
    expect(result.items).toEqual([]);
  });

  it("classifies settlement directions by living account cash flow", () => {
    expect(
      isSettlementIntoLivingAccount("account_to_living"),
    ).toBe(true);
    expect(
      isSettlementIntoLivingAccount("investment_to_living"),
    ).toBe(true);
    expect(
      isSettlementOutOfLivingAccount("living_to_account"),
    ).toBe(true);
    expect(
      isSettlementOutOfLivingAccount("living_to_investment"),
    ).toBe(true);
  });
});
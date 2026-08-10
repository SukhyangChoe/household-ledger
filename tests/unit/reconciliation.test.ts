import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculateLivingAccountLedgerBalance,
  reconciliationDifference,
  type ReconciliationTransactionInput,
} from "@/domain/reconciliation";

const livingAccountId = "living";

function transaction(
  overrides: Partial<ReconciliationTransactionInput>,
): ReconciliationTransactionInput {
  return {
    effective_date: "2026-08-02",
    transaction_type: "expense",
    amount: 0,
    status: "confirmed",
    account_id: "personal",
    fund_purpose: "living",
    living_allocated_amount: null,
    settlement_completed_at: null,
    ...overrides,
  };
}

describe("living account reconciliation", () => {
  it("uses confirmed direct living-account income and expense", () => {
    const balance =
      calculateLivingAccountLedgerBalance({
        baselineActualBalance: 1_000_000,
        baselineDate: "2026-08-01",
        targetDate: "2026-08-10",
        livingAccountId,
        transactions: [
          transaction({
            transaction_type: "income",
            amount: 300_000,
            account_id: livingAccountId,
            fund_purpose: null,
            living_allocated_amount: 300_000,
          }),
          transaction({
            transaction_type: "expense",
            amount: 120_000,
            account_id: livingAccountId,
            fund_purpose: "living",
          }),
        ],
      });

    expect(balance).toBe(1_180_000);
  });

  it("adds completed settlement moved into the living account", () => {
    const balance =
      calculateLivingAccountLedgerBalance({
        baselineActualBalance: 1_000_000,
        baselineDate: "2026-08-01",
        targetDate: "2026-08-10",
        livingAccountId,
        transactions: [
          transaction({
            transaction_type: "income",
            amount: 5_000_000,
            account_id: "husband",
            fund_purpose: null,
            living_allocated_amount: 1_500_000,
            settlement_completed_at:
              "2026-08-05T03:00:00.000Z",
          }),
        ],
      });

    expect(balance).toBe(2_500_000);
  });

  it("subtracts completed living reimbursement paid from the living account", () => {
    const balance =
      calculateLivingAccountLedgerBalance({
        baselineActualBalance: 1_000_000,
        baselineDate: "2026-08-01",
        targetDate: "2026-08-10",
        livingAccountId,
        transactions: [
          transaction({
            amount: 200_000,
            account_id: "husband",
            fund_purpose: "living",
            settlement_completed_at:
              "2026-08-06T03:00:00.000Z",
          }),
        ],
      });

    expect(balance).toBe(800_000);
  });

  it("nets direct living-account income with its completed investment transfer", () => {
    const balance =
      calculateLivingAccountLedgerBalance({
        baselineActualBalance: 1_000_000,
        baselineDate: "2026-08-01",
        targetDate: "2026-08-10",
        livingAccountId,
        transactions: [
          transaction({
            transaction_type: "income",
            amount: 5_000_000,
            account_id: livingAccountId,
            fund_purpose: null,
            living_allocated_amount: 1_500_000,
            settlement_completed_at:
              "2026-08-05T03:00:00.000Z",
          }),
        ],
      });

    expect(balance).toBe(2_500_000);
  });

  it("restores a living-account funded investment expense after settlement", () => {
    const balance =
      calculateLivingAccountLedgerBalance({
        baselineActualBalance: 1_000_000,
        baselineDate: "2026-08-01",
        targetDate: "2026-08-10",
        livingAccountId,
        transactions: [
          transaction({
            transaction_type: "expense",
            amount: 300_000,
            account_id: livingAccountId,
            fund_purpose: "investment",
            settlement_completed_at:
              "2026-08-05T03:00:00.000Z",
          }),
        ],
      });

    expect(balance).toBe(1_000_000);
  });

  it("ignores planned and cancelled transactions", () => {
    const balance =
      calculateLivingAccountLedgerBalance({
        baselineActualBalance: 1_000_000,
        baselineDate: "2026-08-01",
        targetDate: "2026-08-10",
        livingAccountId,
        transactions: [
          transaction({
            status: "planned",
            account_id: livingAccountId,
            amount: 500_000,
          }),
          transaction({
            status: "cancelled",
            account_id: livingAccountId,
            amount: 500_000,
          }),
        ],
      });

    expect(balance).toBe(1_000_000);
  });

  it("does not count movements on or before the baseline date", () => {
    const balance =
      calculateLivingAccountLedgerBalance({
        baselineActualBalance: 1_000_000,
        baselineDate: "2026-08-05",
        targetDate: "2026-08-10",
        livingAccountId,
        transactions: [
          transaction({
            effective_date: "2026-08-05",
            transaction_type: "income",
            amount: 300_000,
            account_id: livingAccountId,
            fund_purpose: null,
            living_allocated_amount: 300_000,
          }),
        ],
      });

    expect(balance).toBe(1_000_000);
  });

  it("calculates actual minus ledger as the reconciliation difference", () => {
    expect(
      reconciliationDifference(
        1_080_000,
        1_100_000,
      ),
    ).toBe(-20_000);
  });
});

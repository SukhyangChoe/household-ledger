import { describe, expect, it } from "vitest";
import { getSettlementInstruction } from "@/domain/settlement";

const living = "living";

describe("settlement rules", () => {
  it("moves allocated income into living account", () => {
    expect(getSettlementInstruction({ transactionType: "income", amount: 5_000_000, accountId: "husband", status: "confirmed", livingAllocatedAmount: 1_410_000 }, living)?.amount).toBe(1_410_000);
  });
  it("moves investment share out when income lands in living account", () => {
    expect(getSettlementInstruction({ transactionType: "income", amount: 5_000_000, accountId: living, status: "confirmed", livingAllocatedAmount: 1_410_000 }, living)?.amount).toBe(3_590_000);
  });
  it("reimburses living expense paid by another account", () => {
    expect(getSettlementInstruction({ transactionType: "expense", amount: 700_000, accountId: "husband", status: "confirmed", fundPurpose: "living" }, living)?.direction).toBe("living_to_account");
  });
  it("reimburses living account for investment expense", () => {
    expect(getSettlementInstruction({ transactionType: "expense", amount: 30_000, accountId: living, status: "confirmed", fundPurpose: "investment" }, living)?.direction).toBe("investment_to_living");
  });
});

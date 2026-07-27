import { describe, expect, it } from "vitest";
import { allocateIncome } from "@/domain/money";

describe("allocateIncome", () => {
  it("allocates 28.2 percent", () => {
    expect(allocateIncome(5_000_000, 2820)).toEqual({ livingAmount: 1_410_000, investmentAmount: 3_590_000 });
  });
  it("allocates 100 percent", () => {
    expect(allocateIncome(1_000_000, 10_000)).toEqual({ livingAmount: 1_000_000, investmentAmount: 0 });
  });
});

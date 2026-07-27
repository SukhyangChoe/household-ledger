import { describe, expect, it } from "vitest";
import { effectiveDateForMonth, occurrenceProgress } from "@/domain/recurring";

describe("recurring rules", () => {
  it("calculates installment-like progress from months", () => {
    expect(occurrenceProgress("2026-10", "2026-07", "2027-06")).toEqual({ current: 4, total: 12 });
  });
  it("uses last day when payment day does not exist", () => {
    expect(effectiveDateForMonth("2027-02", 31)).toBe("2027-02-28");
  });
});

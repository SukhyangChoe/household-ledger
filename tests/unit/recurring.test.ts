import {
  describe,
  expect,
  it,
} from "vitest";

import {
  effectiveDateForMonth,
  isMonthInRecurringRange,
  occurrenceProgress,
} from "@/domain/recurring";

describe("recurring rules", () => {
  it("calculates installment-like progress from months", () => {
    expect(
      occurrenceProgress(
        "2026-10",
        "2026-07",
        "2027-06",
      ),
    ).toEqual({
      current: 4,
      total: 12,
    });
  });

  it("uses last day when payment day does not exist", () => {
    expect(
      effectiveDateForMonth(
        "2027-02",
        31,
      ),
    ).toBe("2027-02-28");
  });

  it("includes both the start and end month", () => {
    expect(
      isMonthInRecurringRange(
        "2026-07",
        "2026-07",
        "2026-09",
      ),
    ).toBe(true);

    expect(
      isMonthInRecurringRange(
        "2026-09",
        "2026-07",
        "2026-09",
      ),
    ).toBe(true);
  });

  it("continues indefinitely when end month is null", () => {
    expect(
      isMonthInRecurringRange(
        "2030-12",
        "2026-07",
        null,
      ),
    ).toBe(true);
  });

  it("returns null progress outside the active range", () => {
    expect(
      occurrenceProgress(
        "2026-06",
        "2026-07",
        "2027-06",
      ),
    ).toBeNull();
  });
});

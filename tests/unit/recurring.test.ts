import {
  describe,
  expect,
  it,
} from "vitest";

import {
  effectiveDateForMonth,
  hasScheduledOccurrenceInRange,
  isMonthInRecurringRange,
  isMonthScheduledForRule,
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

  it("schedules monthly rules in every month within the range", () => {
    expect(
      isMonthScheduledForRule(
        "2026-09",
        "2026-07",
        "2026-12",
        "monthly",
        null,
      ),
    ).toBe(true);
  });

  it("schedules yearly rules only in the selected month", () => {
    expect(
      isMonthScheduledForRule(
        "2027-12",
        "2026-08",
        null,
        "yearly",
        12,
      ),
    ).toBe(true);

    expect(
      isMonthScheduledForRule(
        "2027-11",
        "2026-08",
        null,
        "yearly",
        12,
      ),
    ).toBe(false);
  });

  it("does not schedule a yearly occurrence before the start month", () => {
    expect(
      isMonthScheduledForRule(
        "2026-03",
        "2026-08",
        null,
        "yearly",
        3,
      ),
    ).toBe(false);

    expect(
      isMonthScheduledForRule(
        "2027-03",
        "2026-08",
        null,
        "yearly",
        3,
      ),
    ).toBe(true);
  });

  it("calculates yearly occurrence progress by scheduled years", () => {
    expect(
      occurrenceProgress(
        "2027-12",
        "2026-08",
        "2028-12",
        "yearly",
        12,
      ),
    ).toEqual({
      current: 2,
      total: 3,
    });

    expect(
      occurrenceProgress(
        "2026-10",
        "2026-08",
        "2028-12",
        "yearly",
        12,
      ),
    ).toEqual({
      current: 0,
      total: 3,
    });
  });

  it("detects yearly rules whose finite range has no occurrence", () => {
    expect(
      hasScheduledOccurrenceInRange(
        "2026-08",
        "2026-11",
        "yearly",
        12,
      ),
    ).toBe(false);

    expect(
      hasScheduledOccurrenceInRange(
        "2026-08",
        "2027-01",
        "yearly",
        12,
      ),
    ).toBe(true);
  });
});
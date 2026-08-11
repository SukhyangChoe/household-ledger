import {
  describe,
  expect,
  it,
} from "vitest";

import {
  groupCardTransactions,
} from "@/domain/ledger-card-grouping";

describe("ledger card grouping", () => {
  it("groups manual and recurring card transactions together by card", () => {
    const result =
      groupCardTransactions([
        {
          id: "manual-1",
          cardId: "shinhan",
          amount: 100_000,
          status: "confirmed",
          expenseSummaryGroup:
            "variable",
        },
        {
          id: "recurring-1",
          cardId: "shinhan",
          amount: 17_000,
          status: "planned",
          expenseSummaryGroup:
            "monthly",
        },
        {
          id: "other-card",
          cardId: "hyundai",
          amount: 50_000,
          status: "confirmed",
          expenseSummaryGroup:
            "annual",
        },
      ]);

    expect(result).toHaveLength(2);

    const shinhan = result.find(
      (group) =>
        group.cardId === "shinhan",
    );

    expect(shinhan).toMatchObject({
      count: 2,
      plannedCount: 1,
      confirmedCount: 1,
      totalAmount: 117_000,
    });
    expect(
      shinhan?.amountsBySummaryGroup,
    ).toEqual({
      monthly: 17_000,
      annual: 0,
      variable: 100_000,
      repayment_saving: 0,
    });
  });

  it("keeps unclassified card amounts visible in the aggregate", () => {
    const [group] =
      groupCardTransactions([
        {
          id: "a",
          cardId: "card-1",
          amount: 30_000,
          status: "confirmed",
          expenseSummaryGroup: null,
        },
      ]);

    expect(
      group.unclassifiedAmount,
    ).toBe(30_000);
    expect(group.totalAmount).toBe(
      30_000,
    );
  });

  it("does not mix different cards", () => {
    const result =
      groupCardTransactions([
        {
          id: "a",
          cardId: "card-a",
          amount: 10_000,
          status: "confirmed",
          expenseSummaryGroup:
            "monthly",
        },
        {
          id: "b",
          cardId: "card-b",
          amount: 20_000,
          status: "confirmed",
          expenseSummaryGroup:
            "monthly",
        },
      ]);

    expect(
      result.map((group) => [
        group.cardId,
        group.totalAmount,
      ]),
    ).toEqual([
      ["card-a", 10_000],
      ["card-b", 20_000],
    ]);
  });
});

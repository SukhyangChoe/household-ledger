import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildSetupProgress,
} from "@/domain/setup";

const today = "2026-08-10";

describe("setup progress", () => {
  it("starts incomplete when the household has no settings", () => {
    const progress =
      buildSetupProgress({
        accounts: [],
        rateRules: [],
        categories: [],
        cards: [],
        today,
      });

    expect(progress.ready).toBe(
      false,
    );
    expect(
      progress.completedRequiredSteps,
    ).toBe(0);
    expect(
      progress.nextRequiredStep
        ?.id,
    ).toBe("accounts");
  });

  it("requires an active living account for the account step", () => {
    const progress =
      buildSetupProgress({
        accounts: [
          {
            is_active: true,
            is_living_account:
              false,
          },
        ],
        rateRules: [],
        categories: [],
        cards: [],
        today,
      });

    expect(
      progress.steps[0]
        .complete,
    ).toBe(false);
  });

  it("counts only rate rules that are active on today", () => {
    const progress =
      buildSetupProgress({
        accounts: [
          {
            is_active: true,
            is_living_account:
              true,
          },
        ],
        rateRules: [
          {
            is_active: true,
            valid_from:
              "2026-01-01",
            valid_to:
              "2026-08-09",
          },
          {
            is_active: true,
            valid_from:
              "2026-08-11",
            valid_to: null,
          },
          {
            is_active: true,
            valid_from:
              "2026-08-10",
            valid_to: null,
          },
        ],
        categories: [],
        cards: [],
        today,
      });

    expect(
      progress.currentRateRuleCount,
    ).toBe(1);
    expect(
      progress.steps[1]
        .complete,
    ).toBe(true);
  });

  it("requires at least one active income and expense category", () => {
    const progress =
      buildSetupProgress({
        accounts: [],
        rateRules: [],
        categories: [
          {
            is_active: true,
            transaction_type:
              "income",
          },
          {
            is_active: false,
            transaction_type:
              "expense",
          },
        ],
        cards: [],
        today,
      });

    expect(
      progress.steps[2]
        .complete,
    ).toBe(false);
  });

  it("marks the household ready without requiring a card", () => {
    const progress =
      buildSetupProgress({
        accounts: [
          {
            is_active: true,
            is_living_account:
              true,
          },
        ],
        rateRules: [
          {
            is_active: true,
            valid_from:
              "2026-01-01",
            valid_to: null,
          },
        ],
        categories: [
          {
            is_active: true,
            transaction_type:
              "income",
          },
          {
            is_active: true,
            transaction_type:
              "expense",
          },
        ],
        cards: [],
        today,
      });

    expect(progress.ready).toBe(
      true,
    );
    expect(
      progress.completedRequiredSteps,
    ).toBe(3);
    expect(
      progress.nextRequiredStep,
    ).toBeNull();
    expect(
      progress.activeCardCount,
    ).toBe(0);
  });
});

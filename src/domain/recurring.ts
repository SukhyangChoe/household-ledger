export type RecurrenceFrequency =
  | "monthly"
  | "yearly";

function monthIndex(value: string) {
  const [year, month] = value
    .split("-")
    .map(Number);

  if (
    !year ||
    !month ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(
      "month must use YYYY-MM format",
    );
  }

  return year * 12 + (month - 1);
}

function monthNumber(value: string) {
  const [, month] = value
    .split("-")
    .map(Number);

  if (
    !month ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(
      "month must use YYYY-MM format",
    );
  }

  return month;
}

function validateRecurrenceMonth(
  recurrenceMonth: number | null,
) {
  if (
    recurrenceMonth === null ||
    !Number.isInteger(recurrenceMonth) ||
    recurrenceMonth < 1 ||
    recurrenceMonth > 12
  ) {
    throw new Error(
      "recurrenceMonth must be between 1 and 12 for yearly rules",
    );
  }

  return recurrenceMonth;
}

function firstYearlyOccurrenceIndex(
  startMonth: string,
  recurrenceMonth: number,
) {
  const start = monthIndex(startMonth);
  const startYear = Math.floor(
    start / 12,
  );
  let first =
    startYear * 12 +
    (recurrenceMonth - 1);

  if (first < start) {
    first += 12;
  }

  return first;
}

export function isMonthInRecurringRange(
  targetMonth: string,
  startMonth: string,
  endMonth: string | null,
) {
  const target = monthIndex(
    targetMonth,
  );

  return (
    target >= monthIndex(startMonth) &&
    (endMonth === null ||
      target <= monthIndex(endMonth))
  );
}

export function isMonthScheduledForRule(
  targetMonth: string,
  startMonth: string,
  endMonth: string | null,
  recurrenceFrequency: RecurrenceFrequency,
  recurrenceMonth: number | null,
) {
  if (
    !isMonthInRecurringRange(
      targetMonth,
      startMonth,
      endMonth,
    )
  ) {
    return false;
  }

  if (
    recurrenceFrequency === "monthly"
  ) {
    return true;
  }

  const yearlyMonth =
    validateRecurrenceMonth(
      recurrenceMonth,
    );

  return (
    monthNumber(targetMonth) ===
    yearlyMonth
  );
}

export function hasScheduledOccurrenceInRange(
  startMonth: string,
  endMonth: string | null,
  recurrenceFrequency: RecurrenceFrequency,
  recurrenceMonth: number | null,
) {
  if (endMonth === null) {
    return true;
  }

  if (
    !isMonthInRecurringRange(
      startMonth,
      startMonth,
      endMonth,
    )
  ) {
    return false;
  }

  if (
    recurrenceFrequency === "monthly"
  ) {
    return true;
  }

  const yearlyMonth =
    validateRecurrenceMonth(
      recurrenceMonth,
    );
  const firstOccurrence =
    firstYearlyOccurrenceIndex(
      startMonth,
      yearlyMonth,
    );

  return (
    firstOccurrence <=
    monthIndex(endMonth)
  );
}

export function occurrenceProgress(
  targetMonth: string,
  startMonth: string,
  endMonth: string | null,
  recurrenceFrequency: RecurrenceFrequency =
    "monthly",
  recurrenceMonth: number | null = null,
) {
  if (
    !isMonthInRecurringRange(
      targetMonth,
      startMonth,
      endMonth,
    )
  ) {
    return null;
  }

  const target = monthIndex(
    targetMonth,
  );

  if (
    recurrenceFrequency === "monthly"
  ) {
    const current =
      target -
      monthIndex(startMonth) +
      1;
    const total =
      endMonth === null
        ? null
        : monthIndex(endMonth) -
          monthIndex(startMonth) +
          1;

    return {
      current,
      total,
    };
  }

  const yearlyMonth =
    validateRecurrenceMonth(
      recurrenceMonth,
    );
  const firstOccurrence =
    firstYearlyOccurrenceIndex(
      startMonth,
      yearlyMonth,
    );

  const current =
    target < firstOccurrence
      ? 0
      : Math.floor(
          (target - firstOccurrence) /
            12,
        ) + 1;

  const total =
    endMonth === null
      ? null
      : monthIndex(endMonth) <
          firstOccurrence
        ? 0
        : Math.floor(
            (monthIndex(endMonth) -
              firstOccurrence) /
              12,
          ) + 1;

  return {
    current,
    total,
  };
}

export function effectiveDateForMonth(
  targetMonth: string,
  paymentDay: number,
) {
  if (
    !Number.isInteger(paymentDay) ||
    paymentDay < 1 ||
    paymentDay > 31
  ) {
    throw new Error(
      "paymentDay must be between 1 and 31",
    );
  }

  const [year, month] = targetMonth
    .split("-")
    .map(Number);
  const lastDay = new Date(
    Date.UTC(year, month, 0),
  ).getUTCDate();
  const day = Math.min(
    paymentDay,
    lastDay,
  );

  return `${targetMonth}-${String(
    day,
  ).padStart(2, "0")}`;
}
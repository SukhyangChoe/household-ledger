function monthIndex(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) throw new Error("month must use YYYY-MM format");
  return year * 12 + (month - 1);
}

export function isMonthInRecurringRange(targetMonth: string, startMonth: string, endMonth: string | null) {
  const target = monthIndex(targetMonth);
  return target >= monthIndex(startMonth) && (endMonth === null || target <= monthIndex(endMonth));
}

export function occurrenceProgress(targetMonth: string, startMonth: string, endMonth: string | null) {
  if (!isMonthInRecurringRange(targetMonth, startMonth, endMonth)) return null;
  const current = monthIndex(targetMonth) - monthIndex(startMonth) + 1;
  const total = endMonth === null ? null : monthIndex(endMonth) - monthIndex(startMonth) + 1;
  return { current, total };
}

export function effectiveDateForMonth(targetMonth: string, paymentDay: number) {
  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) throw new Error("paymentDay must be between 1 and 31");
  const [year, month] = targetMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(paymentDay, lastDay);
  return `${targetMonth}-${String(day).padStart(2, "0")}`;
}

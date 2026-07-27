export function allocateIncome(amount: number, rateBps: number) {
  if (!Number.isInteger(amount) || amount < 0) throw new Error("amount must be a non-negative integer");
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10_000) throw new Error("rateBps must be between 0 and 10000");
  const livingAmount = Math.round((amount * rateBps) / 10_000);
  return { livingAmount, investmentAmount: amount - livingAmount };
}

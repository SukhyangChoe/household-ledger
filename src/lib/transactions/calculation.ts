export function calculateLivingAllocatedAmount(
    amount: number,
    rateBps: number,
  ) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("금액은 0보다 큰 안전한 정수여야 합니다.");
    }
  
    if (
      !Number.isInteger(rateBps) ||
      rateBps < 0 ||
      rateBps > 10_000
    ) {
      throw new Error(
        "생활비 반영률은 0부터 10000bp 사이여야 합니다.",
      );
    }
  
    const rounded =
    (BigInt(amount) * BigInt(rateBps) + BigInt(5_000)) /
    BigInt(10_000);
  
    const result = Number(rounded);
  
    if (!Number.isSafeInteger(result)) {
      throw new Error("계산 결과가 안전한 정수 범위를 벗어났습니다.");
    }
  
    return result;
  }
  
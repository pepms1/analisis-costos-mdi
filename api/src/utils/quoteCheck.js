export function applyAdjustment(basePrice, factors = []) {
  if (!basePrice) return null;

  return factors.reduce((accumulator, factor) => accumulator * Number(factor.factor || 1), basePrice);
}

export function classifyQuote(adjustedPrice, quotedPrice) {
  if (!adjustedPrice || !quotedPrice) {
    return { result: "logical", differenceAbsolute: 0, differencePercent: 0 };
  }

  const differenceAbsolute = quotedPrice - adjustedPrice;
  const differencePercent = (differenceAbsolute / adjustedPrice) * 100;

  if (differencePercent > 12) {
    return { result: "high", differenceAbsolute, differencePercent };
  }

  if (differencePercent < -12) {
    return { result: "low", differenceAbsolute, differencePercent };
  }

  return { result: "logical", differenceAbsolute, differencePercent };
}

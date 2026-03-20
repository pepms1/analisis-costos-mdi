export function toMeters(value, measurementUnit = "m") {
  if (typeof value !== "number") return null;
  return measurementUnit === "cm" ? value / 100 : value;
}

export function normalizeDimensions(calculationType, dimensions = {}) {
  if (!dimensions) return null;

  const { measurementUnit = "m" } = dimensions;
  const width = toMeters(dimensions.width, measurementUnit);
  const height = toMeters(dimensions.height, measurementUnit);
  const length = toMeters(dimensions.length, measurementUnit);

  if (calculationType === "area_based" && width && height) {
    return {
      normalizedQuantity: width * height,
      normalizedUnit: "m2",
      derivedValues: { widthM: width, heightM: height },
    };
  }

  if (calculationType === "linear_based" && length) {
    return {
      normalizedQuantity: length,
      normalizedUnit: "ml",
      derivedValues: { lengthM: length },
    };
  }

  if (calculationType === "height_based" && length) {
    return {
      normalizedQuantity: length,
      normalizedUnit: "m",
      derivedValues: { heightM: length },
    };
  }

  return null;
}

export function buildPricingPayload({ calculationType, dimensions, pricingMode, amount }) {
  const normalization = normalizeDimensions(calculationType, dimensions);

  if (!normalization) {
    return {
      originalAmount: amount,
      unitPrice: pricingMode === "unit_price" ? amount : null,
      totalPrice: pricingMode === "total_price" ? amount : null,
      normalizedPrice: null,
      normalizedUnit: null,
      normalizedQuantity: null,
      derivedValues: null,
    };
  }

  const totalPrice = pricingMode === "total_price" ? amount : amount * normalization.normalizedQuantity;
  const unitPrice = pricingMode === "unit_price" ? amount : amount / normalization.normalizedQuantity;

  return {
    originalAmount: amount,
    unitPrice,
    totalPrice,
    normalizedPrice: normalization.normalizedQuantity ? totalPrice / normalization.normalizedQuantity : null,
    normalizedUnit: normalization.normalizedUnit,
    normalizedQuantity: normalization.normalizedQuantity,
    derivedValues: normalization.derivedValues,
  };
}

export function toMeters(value, measurementUnit = "m") {
  if (typeof value !== "number") return null;
  return measurementUnit === "cm" ? value / 100 : value;
}

function resolveLengthWidth(dimensions = {}) {
  if (!dimensions) return { largo: null, ancho: null };

  const measurementUnit = dimensions.measurementUnit || "m";
  const largoRaw = dimensions.largo ?? dimensions.length ?? dimensions.width;

  let anchoRaw = dimensions.ancho ?? dimensions.height;
  if (anchoRaw === undefined || anchoRaw === null) {
    anchoRaw = largoRaw === dimensions.width ? dimensions.length ?? null : dimensions.width ?? null;
  }

  return {
    largo: toMeters(largoRaw, measurementUnit),
    ancho: toMeters(anchoRaw, measurementUnit),
  };
}

export function normalizeDimensions(calculationType, dimensions = {}, requiresDimensions = false) {
  if (!dimensions) return null;

  const isDimensional = requiresDimensions || ["area_based", "linear_based", "height_based"].includes(calculationType);
  if (!isDimensional) return null;

  const { largo, ancho } = resolveLengthWidth(dimensions);
  if (!largo || !ancho) return null;

  return {
    normalizedQuantity: largo * ancho,
    normalizedUnit: "m2",
    derivedValues: { largoM: largo, anchoM: ancho },
  };
}

export function buildPricingPayload({ calculationType, dimensions, pricingMode, amount, requiresDimensions = false }) {
  const normalization = normalizeDimensions(calculationType, dimensions, requiresDimensions);

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

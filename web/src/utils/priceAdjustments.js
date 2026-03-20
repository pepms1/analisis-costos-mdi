function toYear(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCFullYear();
}

function parseInflationByYear(adjustments = []) {
  const inflationSetting = adjustments.find(
    (item) => item.adjustmentType === "inflation" && item.scopeType === "general" && item.isActive
  );

  const inflationByYear = Object.fromEntries(
    (inflationSetting?.factors || [])
      .map((factor) => {
        const year = Number.parseInt(String(factor.label || "").trim(), 10);
        const rate = Number(factor.factor) - 1;
        if (!Number.isInteger(year) || Number.isNaN(rate)) return null;
        return [year, rate];
      })
      .filter(Boolean)
      .sort((a, b) => a[0] - b[0])
  );

  return {
    inflationSetting,
    inflationByYear,
    inflationYears: Object.keys(inflationByYear)
      .map((year) => Number(year))
      .sort((a, b) => a - b),
  };
}

function dedupeRecords(records = [], amountField = "amount") {
  const seen = new Set();
  const deduped = [];

  records.forEach((item) => {
    const amount = Number(item?.[amountField]);
    const recordKey = [
      item?.id || item?._id || "",
      item?.priceDate || "",
      item?.supplierId || "",
      Number.isNaN(amount) ? "nan" : amount,
    ].join("|");

    if (seen.has(recordKey)) return;
    seen.add(recordKey);
    deduped.push(item);
  });

  return deduped;
}

function getInflationFactor(fromYear, targetYear, inflationByYear = {}) {
  if (!Number.isInteger(fromYear) || !Number.isInteger(targetYear) || fromYear >= targetYear) {
    return { factor: 1, missingYears: [] };
  }

  let factor = 1;
  const missingYears = [];

  for (let year = fromYear + 1; year <= targetYear; year += 1) {
    const yearlyRate = inflationByYear[year];
    if (typeof yearlyRate !== "number") {
      missingYears.push(year);
      continue;
    }
    factor *= 1 + yearlyRate;
  }

  return { factor, missingYears };
}

export function calculateAdjustedPrice(records = [], inflationByYear = {}, options = {}) {
  const { amountField = "amount", targetYear } = options;
  const dedupedRecords = dedupeRecords(records, amountField);
  const inflationYears = Object.keys(inflationByYear)
    .map((year) => Number(year))
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => a - b);

  const finalTargetYear = Number.isInteger(targetYear)
    ? targetYear
    : inflationYears[inflationYears.length - 1] || new Date().getUTCFullYear();

  const annotated = dedupedRecords.map((record) => {
    const rawAmount = Number(record?.[amountField]);
    const year = toYear(record?.priceDate);

    const isValidAmount = Number.isFinite(rawAmount) && rawAmount > 0;
    const isValidDate = Number.isInteger(year);

    if (!isValidAmount || !isValidDate) {
      return {
        ...record,
        adjustedAmount: null,
        adjustmentFactor: null,
        inflationMissingYears: [],
        adjustmentStatus: "invalid",
      };
    }

    const { factor, missingYears } = getInflationFactor(year, finalTargetYear, inflationByYear);

    return {
      ...record,
      adjustedAmount: rawAmount * factor,
      adjustmentFactor: factor,
      inflationMissingYears: missingYears,
      adjustmentStatus: "adjusted",
    };
  });

  const validEntries = annotated.filter((record) => Number.isFinite(record.adjustedAmount));
  const sortedByDate = [...validEntries].sort((a, b) => new Date(a.priceDate).getTime() - new Date(b.priceDate).getTime());
  const oldestRecord = sortedByDate[0] || null;
  const latestRecord = sortedByDate[sortedByDate.length - 1] || null;

  const nominalAverage =
    validEntries.length > 0
      ? validEntries.reduce((sum, item) => sum + Number(item[amountField]), 0) / validEntries.length
      : null;

  const adjustedAverage =
    validEntries.length > 0
      ? validEntries.reduce((sum, item) => sum + Number(item.adjustedAmount), 0) / validEntries.length
      : null;

  const inflationMissingYears = Array.from(
    new Set(validEntries.flatMap((item) => item.inflationMissingYears || []))
  ).sort((a, b) => a - b);

  return {
    entries: annotated,
    validEntries,
    oldestRecord,
    latestRecord,
    nominalAverage,
    adjustedAverage,
    targetYear: finalTargetYear,
    inflationMissingYears,
    stats: {
      totalRecords: records.length,
      dedupedRecords: dedupedRecords.length,
      validRecords: validEntries.length,
      invalidRecords: annotated.length - validEntries.length,
    },
  };
}

export { parseInflationByYear };

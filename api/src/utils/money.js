import { AppError } from "./AppError.js";

const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;

function normalizeRawValue(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new AppError("Amount must be a finite value", 400);
    return value.toString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) throw new AppError("Amount is required", 400);
    return trimmed;
  }

  throw new AppError("Amount must be a numeric string", 400);
}

export function parseMoneyInput(value) {
  const normalizedRaw = normalizeRawValue(value);

  if (!MONEY_PATTERN.test(normalizedRaw)) {
    throw new AppError("Amount must be a positive number with up to 2 decimals", 400);
  }

  const [wholePart, decimalPart = ""] = normalizedRaw.split(".");
  const decimals = decimalPart.padEnd(2, "0");
  const cents = Number.parseInt(wholePart, 10) * 100 + Number.parseInt(decimals || "0", 10);

  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new AppError("Amount must be greater than 0", 400);
  }

  return {
    cents,
    normalizedAmount: cents / 100,
    normalizedString: `${wholePart}.${decimals}`,
  };
}

export function centsToAmount(cents) {
  if (!Number.isSafeInteger(cents)) return null;
  return cents / 100;
}

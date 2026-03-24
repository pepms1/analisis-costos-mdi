import { AppError } from "./AppError.js";

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

function buildUtcDate(year, month, day, { endOfDay = false } = {}) {
  const hours = endOfDay ? 23 : 0;
  const minutes = endOfDay ? 59 : 0;
  const seconds = endOfDay ? 59 : 0;
  const milliseconds = endOfDay ? 999 : 0;
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds));
}

export function parseDateOnly(value, { fieldName = "date", endOfDay = false } = {}) {
  if (!value) {
    throw new AppError(`${fieldName} is required`, 400);
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return buildUtcDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate(), { endOfDay });
  }

  const normalizedValue = String(value).trim();
  const match = normalizedValue.match(DATE_ONLY_REGEX);

  if (!match) {
    throw new AppError(`${fieldName} must follow YYYY-MM-DD format`, 400);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = buildUtcDate(year, month, day, { endOfDay });
  const isInvalidDate =
    parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day;

  if (isInvalidDate) {
    throw new AppError(`${fieldName} is not a valid calendar date`, 400);
  }

  return parsed;
}

export function toDateOnlyString(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const dateOnlySlice = value.slice(0, 10);
    if (DATE_ONLY_REGEX.test(dateOnlySlice)) return dateOnlySlice;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

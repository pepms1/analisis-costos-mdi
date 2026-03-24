const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcDateFromDateOnly(dateOnlyValue) {
  const match = String(dateOnlyValue || "").match(DATE_ONLY_REGEX);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() + 1 !== month ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  return utcDate;
}

export function getTodayDateOnlyLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDateOnlyString(value) {
  if (!value) return "";

  const valueAsString = String(value);
  const leadingSlice = valueAsString.slice(0, 10);
  if (DATE_ONLY_REGEX.test(leadingSlice)) return leadingSlice;

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "";

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getYearFromDateOnly(value) {
  const dateOnly = toDateOnlyString(value);
  return dateOnly ? dateOnly.slice(0, 4) : "";
}

export function formatDateOnly(value, locale = "es-MX") {
  const dateOnly = toDateOnlyString(value);
  if (!dateOnly) return "—";

  const utcDate = toUtcDateFromDateOnly(dateOnly);
  if (!utcDate) return "—";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(utcDate);
}

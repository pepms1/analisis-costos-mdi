const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;

export function normalizeMoneyDraft(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!MONEY_PATTERN.test(raw)) return raw;

  const [whole, decimals = ""] = raw.split(".");
  return `${whole}.${decimals.padEnd(2, "0")}`;
}

export function isValidMoneyInput(value) {
  return MONEY_PATTERN.test(String(value ?? "").trim());
}

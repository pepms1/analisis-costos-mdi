import { formatDateOnly } from "./dateOnly";

export function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function formatCalendarDate(value) {
  return formatDateOnly(value, "es-MX");
}

export function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value));
}

export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toFixed(2)}%`;
}

export function formatProjectsCompact(projectNames = [], { maxVisible = 2 } = {}) {
  const normalizedNames = Array.isArray(projectNames)
    ? [...new Set(projectNames.map((name) => String(name || "").trim()).filter(Boolean))]
    : [];
  if (!normalizedNames.length) return "Sin obra";
  if (normalizedNames.length <= maxVisible) return normalizedNames.join(", ");
  const visible = normalizedNames.slice(0, maxVisible).join(", ");
  const remaining = normalizedNames.length - maxVisible;
  return `${visible}, +${remaining}`;
}

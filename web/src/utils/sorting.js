const SPANISH_LOCALE = "es";

export function compareSpanishLabels(a, b) {
  return String(a || "").localeCompare(String(b || ""), SPANISH_LOCALE, {
    sensitivity: "base",
    numeric: true,
  });
}

export function sortByLabel(items = [], getLabel = (item) => item?.label ?? item?.name ?? "") {
  return [...items].sort((a, b) => compareSpanishLabels(getLabel(a), getLabel(b)));
}

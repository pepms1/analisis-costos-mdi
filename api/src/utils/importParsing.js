function cleanTextValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function normalizeText(value) {
  const raw = cleanTextValue(value);
  const normalized = raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[.,;:¡!¿?()\[\]{}"'`´]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { raw, normalized };
}

export function parseFlexibleNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const raw = cleanTextValue(value);
  if (!raw) return null;

  const cleaned = raw.replace(/[$€£%]/g, "").replace(/\s+/g, "").replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;

  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  let normalized = cleaned;

  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    if (decimalSeparator === ",") {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    const commaParts = cleaned.split(",");
    if (commaParts.length === 2 && commaParts[1].length <= 2) {
      normalized = cleaned.replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else {
    normalized = cleaned;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const UNIT_MAP = new Map([
  ["pza", "pieza"],
  ["pieza", "pieza"],
  ["piezas", "pieza"],
  ["pz", "pieza"],
  ["m2", "m2"],
  ["m²", "m2"],
  ["mt2", "m2"],
  ["m 2", "m2"],
  ["m3", "m3"],
  ["mt3", "m3"],
  ["m 3", "m3"],
  ["kg", "kg"],
  ["kilo", "kg"],
  ["kilos", "kg"],
  ["kilogramo", "kg"],
  ["kilogramos", "kg"],
  ["jor", "jornal"],
  ["jornal", "jornal"],
  ["ml", "metro lineal"],
  ["metro lineal", "metro lineal"],
  ["metros lineales", "metro lineal"],
]);

export function normalizeUnit(value) {
  const { raw, normalized } = normalizeText(value);
  if (!normalized) {
    return { raw, normalized: "" };
  }
  return {
    raw,
    normalized: UNIT_MAP.get(normalized) || normalized,
  };
}

function excelSerialToDate(serial) {
  const value = Number(serial);
  if (!Number.isFinite(value)) return null;

  const utcDays = Math.floor(value - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);

  if (Number.isNaN(dateInfo.getTime())) return null;
  return dateInfo;
}

export function parseFlexibleDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { date: value, iso: value.toISOString().slice(0, 10), warning: null };
  }

  if (typeof value === "number") {
    const date = excelSerialToDate(value);
    if (!date) return { date: null, iso: null, warning: "Fecha serial de Excel inválida" };
    return { date, iso: date.toISOString().slice(0, 10), warning: null };
  }

  const raw = cleanTextValue(value);
  if (!raw) return { date: null, iso: null, warning: null };

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const date = excelSerialToDate(Number(raw));
    if (date) return { date, iso: date.toISOString().slice(0, 10), warning: null };
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const date = new Date(`${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      return { date, iso: date.toISOString().slice(0, 10), warning: null };
    }
  }

  const dmyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmyMatch) {
    const year = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
    const date = new Date(`${year}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      return { date, iso: date.toISOString().slice(0, 10), warning: null };
    }
  }

  return { date: null, iso: null, warning: "No se pudo interpretar la fecha" };
}

export function isLikelySummaryRow(concept) {
  const text = normalizeText(concept).normalized;
  if (!text) return false;
  return /\b(total|subtotal|resumen|acumulado|sumatoria|suma)\b/.test(text);
}

export function isRowCompletelyEmpty(values = []) {
  return values.every((value) => !cleanTextValue(value));
}

export function getMappedCell(rowValues = [], mappingKey) {
  if (!mappingKey || typeof mappingKey !== "string" || !mappingKey.startsWith("col_")) {
    return "";
  }

  const index = Number(mappingKey.replace("col_", ""));
  if (!Number.isInteger(index) || index < 0) {
    return "";
  }

  return cleanTextValue(rowValues[index]);
}

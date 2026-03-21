import { ImportSession } from "../models/ImportSession.js";
import { ImportRow } from "../models/ImportRow.js";
import { ImportRowDecision } from "../models/ImportRowDecision.js";
import { ImportRowSuggestion } from "../models/ImportRowSuggestion.js";
import { Concept } from "../models/Concept.js";
import { PriceRecord } from "../models/PriceRecord.js";
import { Supplier } from "../models/Supplier.js";
import { Category } from "../models/Category.js";
import { Project } from "../models/Project.js";
import mongoose from "mongoose";
import { AppError } from "../utils/AppError.js";
import { parseMoneyInput } from "../utils/money.js";
import {
  getWorkbookPreview,
  getWorkbookSheetRows,
  getWorkbookSheets,
  resolveStoredFilePath,
  storeImportFile,
} from "../services/importWorkbookService.js";
import {
  detectEmbeddedDimensions,
  getMappedCell,
  inferApplicationUnitSuggestion,
  isLikelySummaryRow,
  isRowCompletelyEmpty,
  normalizeText,
  normalizeUnit,
  parseFlexibleDate,
  parseFlexibleNumber,
} from "../utils/importParsing.js";

const MAPPING_CANDIDATES = {
  concept: ["concepto", "descripción", "descripcion", "partida", "insumo", "producto", "servicio"],
  unit: ["unidad", "u.m.", "um", "und"],
  quantity: ["cantidad", "cant", "qty"],
  unitPrice: ["p.u.", "pu", "unitario", "precio unitario", "costo unitario"],
  amount: ["importe", "total", "subtotal", "monto"],
  supplier: ["proveedor", "contratista", "empresa"],
  date: ["fecha", "vigencia"],
  originalCategory: ["categoria", "categoría", "rubro"],
  observations: ["observaciones", "observación", "notas", "nota"],
};
const SURFACE_ANALYSIS_UNITS = new Set(["m2", "m²", "mt2"]);

function serializeSession(session) {
  const id = session.id || session._id?.toString();

  return {
    id,
    fileName: session.fileName,
    fileType: session.fileType,
    sourceType: session.sourceType,
    sheetName: session.sheetName,
    status: session.status,
    obraId: session.obraId,
    defaultSupplierId: session.defaultSupplierId,
    defaultCategoryId: session.defaultCategoryId,
    defaultDate: session.defaultDate,
    detectedSupplierId: session.detectedSupplierId || null,
    detectedWorkId: session.detectedWorkId || null,
    detectedYear: session.detectedYear ?? null,
    detectedDate: session.detectedDate || null,
    detectedContextJson: session.detectedContextJson || null,
    columnMappingJson: session.columnMappingJson,
    optionsJson: session.optionsJson,
    createdBy: session.createdBy,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function normalizeHeader(value = "") {
  return value
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectHeaderAndMapping(rows = []) {
  if (!rows.length) {
    return {
      detectedHeaderRowIndex: 1,
      detectedDataStartRowIndex: 2,
      detectedMapping: {},
      columns: [],
    };
  }

  const candidateRows = rows.slice(0, 10);
  let bestRowIndex = 0;
  let bestScore = -1;

  candidateRows.forEach((row, index) => {
    const normalizedCells = row.map((cell) => normalizeHeader(cell));
    let score = 0;

    Object.values(MAPPING_CANDIDATES).forEach((keywords) => {
      if (keywords.some((keyword) => normalizedCells.some((cell) => cell.includes(normalizeHeader(keyword))))) {
        score += 1;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = index;
    }
  });

  const headerRow = rows[bestRowIndex] || [];
  const columns = headerRow.map((value, index) => ({
    index,
    key: `col_${index}`,
    label: value || `Columna ${index + 1}`,
  }));

  const detectedMapping = {};

  Object.entries(MAPPING_CANDIDATES).forEach(([targetField, keywords]) => {
    const found = columns.find((column) => {
      const normalized = normalizeHeader(column.label);
      return keywords.some((keyword) => normalized.includes(normalizeHeader(keyword)));
    });

    if (found) {
      detectedMapping[targetField] = found.key;
    }
  });

  return {
    detectedHeaderRowIndex: bestRowIndex + 1,
    detectedDataStartRowIndex: bestRowIndex + 2,
    detectedMapping,
    columns,
  };
}

function getCellPositions(rowValues = []) {
  const positions = [];
  rowValues.forEach((cell, index) => {
    const text = String(cell || "").trim();
    if (text) {
      positions.push({ colIndex: index, value: text });
    }
  });
  return positions;
}

function getContextDateFromYear(year) {
  if (!year) return null;
  return new Date(Date.UTC(Number(year), 0, 1));
}

function detectDocumentContext({
  rowEntries = [],
  detectedHeaderRowIndex = 1,
  suppliers = [],
  projects = [],
}) {
  if (!rowEntries.length) {
    return {
      detectedSupplierId: null,
      detectedWorkId: null,
      detectedYear: null,
      detectedDate: null,
      detectedContextJson: {
        confidence: "low",
        reasons: ["No se detectaron filas con contenido para inferir contexto."],
      },
    };
  }

  const headerEntry = rowEntries.find((entry) => entry.rowNumber === detectedHeaderRowIndex);
  const headerPositions = getCellPositions(headerEntry?.values || []);
  const headerMinCol = headerPositions.length ? Math.min(...headerPositions.map((item) => item.colIndex)) : 0;
  const headerMaxCol = headerPositions.length ? Math.max(...headerPositions.map((item) => item.colIndex)) : 8;

  const scanEntries = rowEntries.filter((entry) => {
    if (entry.rowNumber <= 15) return true;
    if (Math.abs(entry.rowNumber - detectedHeaderRowIndex) <= 4) return true;
    if (entry.rowNumber < detectedHeaderRowIndex) return true;
    const positions = getCellPositions(entry.values || []);
    return positions.some((item) => item.colIndex < headerMinCol - 1 || item.colIndex > headerMaxCol + 1);
  });

  const candidateTokens = [];
  scanEntries.forEach((entry) => {
    const positions = getCellPositions(entry.values || []);
    positions.forEach(({ colIndex, value }) => {
      const outsideHeaderRange = colIndex < headerMinCol - 1 || colIndex > headerMaxCol + 1;
      const aroundHeader = Math.abs(entry.rowNumber - detectedHeaderRowIndex) <= 4;
      const inFirstRows = entry.rowNumber <= 15;
      const zone = outsideHeaderRange ? "outside_table" : aroundHeader ? "around_header" : inFirstRows ? "first_rows" : "other";

      candidateTokens.push({
        rowNumber: entry.rowNumber,
        colIndex,
        value,
        normalized: normalizeText(value).normalized,
        zone,
      });
    });
  });

  const supplierScores = new Map();
  const projectScores = new Map();
  const reasons = [];

  suppliers.forEach((supplier) => {
    const normalizedName = normalizeText(supplier.name).normalized;
    if (!normalizedName) return;

    candidateTokens.forEach((token) => {
      if (!token.normalized) return;
      const exact = token.normalized === normalizedName;
      const partial = token.normalized.includes(normalizedName) || normalizedName.includes(token.normalized);
      if (!exact && !partial) return;

      const increment = exact ? 0.55 : 0.35;
      const weight =
        token.zone === "first_rows" ? 1 :
        token.zone === "around_header" ? 0.9 :
        token.zone === "outside_table" ? 0.85 : 0.6;

      const current = supplierScores.get(String(supplier._id)) || { score: 0, hits: [] };
      current.score += increment * weight;
      current.hits.push({
        row: token.rowNumber,
        col: token.colIndex,
        value: token.value,
        mode: exact ? "exact" : "partial",
        zone: token.zone,
      });
      supplierScores.set(String(supplier._id), current);
    });
  });

  projects.forEach((project) => {
    const normalizedName = normalizeText(project.name).normalized;
    if (!normalizedName) return;

    candidateTokens.forEach((token) => {
      if (!token.normalized) return;
      const exact = token.normalized === normalizedName;
      const partial = token.normalized.includes(normalizedName) || normalizedName.includes(token.normalized);
      if (!exact && !partial) return;

      const increment = exact ? 0.6 : 0.35;
      const weight =
        token.zone === "first_rows" ? 1 :
        token.zone === "around_header" ? 0.9 :
        token.zone === "outside_table" ? 0.85 : 0.6;

      const current = projectScores.get(String(project._id)) || { score: 0, hits: [] };
      current.score += increment * weight;
      current.hits.push({
        row: token.rowNumber,
        col: token.colIndex,
        value: token.value,
        mode: exact ? "exact" : "partial",
        zone: token.zone,
      });
      projectScores.set(String(project._id), current);
    });
  });

  const yearMatches = [];
  candidateTokens.forEach((token) => {
    const regex = /\b(19\d{2}|20\d{2}|21\d{2})\b/g;
    let match = regex.exec(token.value);
    while (match) {
      const year = Number(match[1]);
      if (year >= 1990 && year <= 2100) {
        yearMatches.push({
          year,
          row: token.rowNumber,
          col: token.colIndex,
          value: token.value,
          zone: token.zone,
          score: token.zone === "first_rows" || token.zone === "around_header" ? 0.7 : 0.4,
        });
      }
      match = regex.exec(token.value);
    }
  });

  const bestSupplier = [...supplierScores.entries()]
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.score - a.score)[0];
  const bestProject = [...projectScores.entries()]
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.score - a.score)[0];
  const bestYear = yearMatches.sort((a, b) => b.score - a.score)[0] || null;

  if (bestSupplier) reasons.push(`Proveedor detectado por coincidencias de texto (${bestSupplier.hits.length} match).`);
  if (bestProject) reasons.push(`Obra detectada por coincidencias de texto (${bestProject.hits.length} match).`);
  if (bestYear) reasons.push(`Año detectado desde celdas de contexto (${bestYear.year}).`);
  if (!reasons.length) reasons.push("No se detectó contexto fuerte en las celdas escaneadas.");

  const maxScore = Math.max(bestSupplier?.score || 0, bestProject?.score || 0, bestYear?.score || 0);
  const confidence = maxScore >= 1.2 ? "high" : maxScore >= 0.7 ? "medium" : "low";

  return {
    detectedSupplierId: bestSupplier && bestSupplier.score >= 0.45 ? bestSupplier.id : null,
    detectedWorkId: bestProject && bestProject.score >= 0.45 ? bestProject.id : null,
    detectedYear: bestYear ? bestYear.year : null,
    detectedDate: bestYear ? getContextDateFromYear(bestYear.year) : null,
    detectedContextJson: {
      confidence,
      scannedRows: scanEntries.map((entry) => entry.rowNumber),
      headerRange: { minCol: headerMinCol, maxCol: headerMaxCol },
      reasons,
      supplier: bestSupplier || null,
      work: bestProject || null,
      year: bestYear || null,
    },
  };
}

function getSessionStorageName(session) {
  const storageName = session.optionsJson?.fileStorageName;
  if (!storageName) {
    throw new AppError("La sesión no tiene archivo cargado aún", 400);
  }
  return storageName;
}

export async function createImportSession(req, res) {
  const payload = req.validatedBody;

  const session = await ImportSession.create({
    ...payload,
    defaultDate: payload.defaultDate ? new Date(payload.defaultDate) : null,
    createdBy: req.user.id,
    status: payload.status || "uploaded",
  });

  res.status(201).json({ item: serializeSession(session) });
}

export async function uploadImportSessionFile(req, res) {
  const session = await ImportSession.findById(req.params.id);

  if (!session) {
    throw new AppError("Import session not found", 404);
  }

  const { fileName, fileType, fileBase64 } = req.validatedBody;
  const stored = await storeImportFile({ fileName, fileBase64 });

  const sheets = getWorkbookSheets(stored.fullPath);

  session.fileName = fileName;
  session.fileType = fileType || session.fileType;
  session.status = "uploaded";
  session.optionsJson = {
    ...(session.optionsJson || {}),
    fileStorageName: stored.storageName,
    fileSizeBytes: stored.sizeBytes,
    detectedSheets: sheets,
    uploadedAt: new Date().toISOString(),
  };

  await session.save();

  res.status(201).json({
    item: serializeSession(session),
    sheets,
  });
}

export async function getImportSession(req, res) {
  const session = await ImportSession.findById(req.params.id).lean();

  if (!session) {
    throw new AppError("Import session not found", 404);
  }

  res.json({ item: serializeSession(session) });
}

export async function listImportSessionSheets(req, res) {
  const session = await ImportSession.findById(req.params.id);

  if (!session) {
    throw new AppError("Import session not found", 404);
  }

  const filePath = resolveStoredFilePath(getSessionStorageName(session));
  const sheets = getWorkbookSheets(filePath);

  session.optionsJson = {
    ...(session.optionsJson || {}),
    detectedSheets: sheets,
  };
  await session.save();

  res.json({ items: sheets });
}

export async function getImportSessionPreview(req, res) {
  const session = await ImportSession.findById(req.params.id);

  if (!session) {
    throw new AppError("Import session not found", 404);
  }

  const filePath = resolveStoredFilePath(getSessionStorageName(session));
  const requestedSheet = req.query.sheet?.toString() || session.sheetName || "";
  const preview = getWorkbookPreview(filePath, requestedSheet);
  const scanPayload = getWorkbookSheetRows(filePath, requestedSheet, 180);

  const { detectedHeaderRowIndex, detectedDataStartRowIndex, detectedMapping, columns } = detectHeaderAndMapping(preview.rows || []);
  const [suppliers, projects] = await Promise.all([
    Supplier.find({ isActive: true }).select("_id name").lean(),
    Project.find({ isActive: true }).select("_id name").lean(),
  ]);

  const detectedContext = detectDocumentContext({
    rowEntries: scanPayload.rowEntries || [],
    detectedHeaderRowIndex,
    suppliers,
    projects,
  });

  session.detectedSupplierId = detectedContext.detectedSupplierId;
  session.detectedWorkId = detectedContext.detectedWorkId;
  session.detectedYear = detectedContext.detectedYear;
  session.detectedDate = detectedContext.detectedDate;
  session.detectedContextJson = detectedContext.detectedContextJson;
  await session.save();

  res.json({
    item: {
      sheetName: preview.sheet,
      totalRowsWithContent: preview.rowCount || 0,
      rows: preview.rows || [],
      columns,
      detectedHeaderRowIndex,
      detectedDataStartRowIndex,
      detectedMapping,
      detectedContext,
    },
  });
}

export async function saveImportSessionMapping(req, res) {
  const session = await ImportSession.findById(req.params.id);

  if (!session) {
    throw new AppError("Import session not found", 404);
  }

  const payload = req.validatedBody;

  session.sheetName = payload.sheetName;
  session.columnMappingJson = payload.columnMappingJson;
  session.optionsJson = {
    ...(session.optionsJson || {}),
    ...(payload.optionsJson || {}),
    headerRowIndex: payload.headerRowIndex,
    dataStartRowIndex: payload.dataStartRowIndex,
    ignoreEmptyRows: payload.ignoreEmptyRows,
  };
  session.detectedSupplierId = payload.detectedSupplierId ?? session.detectedSupplierId ?? null;
  session.detectedWorkId = payload.detectedWorkId ?? session.detectedWorkId ?? null;
  session.detectedYear = payload.detectedYear ?? session.detectedYear ?? null;
  session.detectedDate = payload.detectedDate ? new Date(payload.detectedDate) : session.detectedDate ?? null;
  if (payload.detectedContextJson) {
    session.detectedContextJson = payload.detectedContextJson;
  }
  session.status = "mapped";

  await session.save();

  res.json({ item: serializeSession(session) });
}

function toDisplayValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toSafeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function getTokenSet(text = "") {
  return new Set(
    normalizeText(text)
      .normalized.split(" ")
      .map((token) => token.trim())
      .filter(Boolean)
  );
}

function getConceptSimilarity(source = "", target = "") {
  const normalizedSource = normalizeText(source).normalized;
  const normalizedTarget = normalizeText(target).normalized;

  if (!normalizedSource || !normalizedTarget) return 0;
  if (normalizedSource === normalizedTarget) return 1;
  if (normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource)) return 0.9;

  const sourceTokens = getTokenSet(normalizedSource);
  const targetTokens = getTokenSet(normalizedTarget);

  if (!sourceTokens.size || !targetTokens.size) return 0;

  let overlap = 0;
  sourceTokens.forEach((token) => {
    if (targetTokens.has(token)) overlap += 1;
  });

  const union = new Set([...sourceTokens, ...targetTokens]).size || 1;
  return Math.min(1, overlap / union);
}

function getRecencyScore(priceDate) {
  if (!priceDate) return 0;
  const date = new Date(priceDate);
  if (Number.isNaN(date.getTime())) return 0;

  const now = new Date();
  const ageInDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays <= 90) return 1;
  if (ageInDays <= 365) return 0.75;
  if (ageInDays <= 730) return 0.5;
  return 0.2;
}

function getSupplierScore(rowSupplier = "", candidateSupplierName = "") {
  const normalizedRowSupplier = normalizeText(rowSupplier).normalized;
  const normalizedCandidateSupplier = normalizeText(candidateSupplierName).normalized;

  if (!normalizedRowSupplier || !normalizedCandidateSupplier) return 0;
  if (normalizedRowSupplier === normalizedCandidateSupplier) return 1;
  if (
    normalizedRowSupplier.includes(normalizedCandidateSupplier) ||
    normalizedCandidateSupplier.includes(normalizedRowSupplier)
  ) {
    return 0.8;
  }

  const tokenScore = getConceptSimilarity(normalizedRowSupplier, normalizedCandidateSupplier);
  return tokenScore >= 0.5 ? 0.6 : 0;
}

function getUnitScore(rowUnit = "", candidateUnit = "") {
  const rowNormalized = normalizeUnit(rowUnit).normalized;
  const candidateNormalized = normalizeUnit(candidateUnit).normalized;

  if (!rowNormalized || !candidateNormalized) return 0;
  if (rowNormalized === candidateNormalized) return 1;
  return 0;
}

function getPriceCoherenceScore(rowPrice, candidatePrice) {
  const parsedRowPrice = toSafeNumber(rowPrice);
  const parsedCandidatePrice = toSafeNumber(candidatePrice);

  if (!parsedRowPrice || !parsedCandidatePrice || parsedCandidatePrice <= 0) return 0.5;

  const relativeDiff = Math.abs(parsedRowPrice - parsedCandidatePrice) / parsedCandidatePrice;
  if (relativeDiff <= 0.1) return 1;
  if (relativeDiff <= 0.25) return 0.7;
  if (relativeDiff <= 0.5) return 0.4;
  return 0;
}

function classifyConfidence(score) {
  if (score >= 0.85) return "high";
  if (score >= 0.65) return "medium";
  return "low";
}

function buildParsedRow({ session, rowEntry, mapping }) {
  const rowValues = rowEntry.values || [];
  const rawConcept = getMappedCell(rowValues, mapping.concept);
  const rawUnit = getMappedCell(rowValues, mapping.unit);
  const rawQuantity = getMappedCell(rowValues, mapping.quantity);
  const rawUnitPrice = getMappedCell(rowValues, mapping.unitPrice);
  const rawAmount = getMappedCell(rowValues, mapping.amount);
  const rawSupplier = getMappedCell(rowValues, mapping.supplier);
  const rawDate = getMappedCell(rowValues, mapping.date);
  const rawCategory = getMappedCell(rowValues, mapping.originalCategory);

  const conceptInfo = normalizeText(rawConcept);
  const unitInfo = normalizeUnit(rawUnit);
  const quantity = parseFlexibleNumber(rawQuantity);
  const unitPrice = parseFlexibleNumber(rawUnitPrice);
  const amount = parseFlexibleNumber(rawAmount);
  const parsedDate = parseFlexibleDate(rawDate);
  const { detectedDimensions, applicationSuggestion } = detectEmbeddedDimensions(`${rawConcept} ${conceptInfo.normalized}`);
  const standaloneApplicationSuggestion = applicationSuggestion || inferApplicationUnitSuggestion(`${rawConcept} ${conceptInfo.normalized}`);

  const warnings = [];
  const errors = [];

  if (!conceptInfo.normalized) {
    if (quantity === null && unitPrice === null && amount === null) {
      errors.push("Fila sin concepto y sin datos numéricos mínimos");
    } else {
      warnings.push("Fila sin concepto claro");
    }
  }

  if (rawDate && parsedDate.warning) {
    warnings.push(parsedDate.warning);
  }

  if (rawQuantity && quantity === null) warnings.push("Cantidad no interpretable");
  if (rawUnitPrice && unitPrice === null) warnings.push("Precio unitario no interpretable");
  if (rawAmount && amount === null) warnings.push("Importe no interpretable");

  const parseStatus = errors.length ? "error" : warnings.length ? "warning" : "parsed";

  return {
    sessionId: session.id,
    sheetRowNumber: rowEntry.rowNumber,
    rawJson: {
      rowValues,
      normalized: {
        concept: conceptInfo.normalized,
        unit: unitInfo.normalized,
        quantity,
        unitPrice,
        amount,
        supplier: normalizeText(rawSupplier).normalized,
        category: normalizeText(rawCategory).normalized,
        dateIso: parsedDate.iso,
        detectedDimensions,
        suggestedApplicationUnit: standaloneApplicationSuggestion?.suggestedApplicationUnit || null,
        applicationSuggestion,
      },
      warnings,
      errors,
    },
    rawConcept,
    rawUnit: toDisplayValue(rawUnit),
    rawQuantity: toDisplayValue(rawQuantity),
    rawUnitPrice: toDisplayValue(rawUnitPrice),
    rawAmount: toDisplayValue(rawAmount),
    rawSupplier: toDisplayValue(rawSupplier),
    rawDate: toDisplayValue(rawDate),
    rawCategory: toDisplayValue(rawCategory),
    normalizedConcept: conceptInfo.normalized,
    parseStatus,
    matchStatus: "pending",
    confidenceScore: 0,
  };
}

export async function parseImportSessionRows(req, res) {
  const session = await ImportSession.findById(req.params.id);

  if (!session) {
    throw new AppError("Import session not found", 404);
  }

  if (!session.optionsJson?.fileStorageName) {
    throw new AppError("La sesión no tiene archivo cargado", 400);
  }

  if (!session.sheetName) {
    throw new AppError("La sesión no tiene hoja seleccionada", 400);
  }

  if (!session.columnMappingJson || !Object.keys(session.columnMappingJson).length) {
    throw new AppError("La sesión no tiene mapeo de columnas guardado", 400);
  }

  const filePath = resolveStoredFilePath(getSessionStorageName(session));
  const sheetPayload = getWorkbookSheetRows(filePath, session.sheetName);
  const rowEntries = sheetPayload.rowEntries || [];

  const startRow = Number(session.optionsJson?.dataStartRowIndex) || 2;
  const ignoreEmptyRows = session.optionsJson?.ignoreEmptyRows !== false;

  let totalReviewed = 0;
  let totalIgnored = 0;
  let totalWarnings = 0;
  let totalErrors = 0;

  const docs = [];

  rowEntries.forEach((rowEntry) => {
    if (rowEntry.rowNumber < startRow) {
      return;
    }

    totalReviewed += 1;

    if (ignoreEmptyRows && isRowCompletelyEmpty(rowEntry.values)) {
      totalIgnored += 1;
      return;
    }

    const tentativeConcept = getMappedCell(rowEntry.values, session.columnMappingJson?.concept);

    if (isLikelySummaryRow(tentativeConcept)) {
      totalIgnored += 1;
      return;
    }

    const rowDoc = buildParsedRow({
      session,
      rowEntry,
      mapping: session.columnMappingJson || {},
    });


    if (rowDoc.parseStatus === "warning") totalWarnings += 1;
    if (rowDoc.parseStatus === "error") totalErrors += 1;

    docs.push(rowDoc);
  });

  await ImportRow.deleteMany({ sessionId: session.id });

  if (docs.length) {
    await ImportRow.insertMany(docs, { ordered: false });
  }

  session.status = "parsed";
  session.optionsJson = {
    ...(session.optionsJson || {}),
    lastParsedAt: new Date().toISOString(),
    parseSummary: {
      totalReviewed,
      totalCreated: docs.length,
      totalIgnored,
      totalWarnings,
      totalErrors,
    },
  };
  await session.save();

  res.json({
    summary: {
      totalReviewed,
      totalCreated: docs.length,
      totalIgnored,
      totalWarnings,
      totalErrors,
    },
    sample: docs.slice(0, 20).map((row) => ({
      sheetRowNumber: row.sheetRowNumber,
      concept: row.rawConcept,
      unit: row.rawUnit,
      quantity: row.rawQuantity,
      unitPrice: row.rawUnitPrice,
      amount: row.rawAmount,
      supplier: row.rawSupplier,
      date: row.rawDate,
      parseStatus: row.parseStatus,
    })),
    item: serializeSession(session),
  });
}

function buildSuggestionPayload({ row, candidate, conceptById, supplierById, categoryById, frequentCategoryByConcept }) {
  const reasons = [];

  if (candidate.conceptSimilarity >= 1) {
    reasons.push("Coincidencia exacta normalizada con histórico");
  } else if (candidate.conceptSimilarity >= 0.7) {
    reasons.push("Coincidencia parcial razonable de concepto");
  }

  if (candidate.unitScore >= 1) reasons.push("Unidad compatible");
  if (candidate.supplierScore >= 1) reasons.push("Mismo proveedor");
  else if (candidate.supplierScore >= 0.6) reasons.push("Proveedor similar");
  if (candidate.recencyScore >= 0.75) reasons.push("Histórico reciente");
  if (candidate.priceScore >= 0.7) reasons.push("Precio importado dentro de rango cercano");

  const frequentCategory = frequentCategoryByConcept.get(String(candidate.priceRecord.conceptId || ""));
  if (frequentCategory && String(frequentCategory.categoryId) === String(candidate.priceRecord.categoryId)) {
    reasons.push("Categoría frecuente asociada al concepto");
  }

  const score = Math.max(
    0,
    Math.min(
      1,
      candidate.conceptSimilarity * 0.5 +
        candidate.unitScore * 0.15 +
        candidate.supplierScore * 0.15 +
        candidate.recencyScore * 0.1 +
        candidate.priceScore * 0.1
    )
  );

  const suggestedCategory = categoryById.get(String(candidate.priceRecord.categoryId));
  const suggestedSupplier = supplierById.get(String(candidate.priceRecord.supplierId || ""));
  const suggestedConcept = conceptById.get(String(candidate.priceRecord.conceptId || ""));

  return {
    importRowId: row._id,
    suggestedCategoryId: candidate.priceRecord.categoryId || null,
    suggestedSupplierId: candidate.priceRecord.supplierId || null,
    suggestedCost: candidate.priceRecord.unitPrice || candidate.priceRecord.normalizedPrice || candidate.priceRecord.totalPrice || null,
    suggestedDate: candidate.priceRecord.priceDate || null,
    suggestedHistoricId: candidate.priceRecord._id || null,
    suggestedWorkId: candidate.priceRecord.projectId || null,
    score,
    reasonJson: {
      confidenceLabel: classifyConfidence(score),
      reasons: reasons.length ? reasons : ["Sin coincidencia confiable"],
      breakdown: {
        concept: Number(candidate.conceptSimilarity.toFixed(3)),
        unit: Number(candidate.unitScore.toFixed(3)),
        supplier: Number(candidate.supplierScore.toFixed(3)),
        recency: Number(candidate.recencyScore.toFixed(3)),
        coherence: Number(candidate.priceScore.toFixed(3)),
      },
      matched: {
        conceptName: suggestedConcept?.name || "",
        categoryName: suggestedCategory?.name || "",
        supplierName: suggestedSupplier?.name || "",
      },
    },
  };
}

function normalizeDecisionType(value = "") {
  const mapping = {
    accept: "accepted",
    accepted: "accepted",
    edit: "edited",
    edited: "edited",
    ignore: "ignored",
    ignored: "ignored",
    pending: "new",
    new: "new",
  };
  return mapping[String(value).toLowerCase()] || "new";
}

function normalizeObjectIdInput(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return mongoose.Types.ObjectId.isValid(trimmed) ? trimmed : null;
  }

  if (typeof value === "object") {
    const candidate = value.value ?? value.id ?? value._id ?? null;
    if (!candidate) return null;
    return normalizeObjectIdInput(candidate);
  }

  return null;
}

function serializeDecision(decision) {
  if (!decision) return null;
  return {
    id: decision._id?.toString() || decision.id,
    importRowId: decision.importRowId,
    decisionType: normalizeDecisionType(decision.decisionType),
    finalCategoryId: decision.finalCategoryId,
    finalSupplierId: decision.finalSupplierId,
    finalCost: decision.finalCost,
    finalDate: decision.finalDate,
    finalWorkId: decision.finalWorkId,
    finalNotes: decision.finalNotes || "",
    finalMeasurementsJson: decision.finalMeasurementsJson || null,
    savedHistoricId: decision.savedHistoricId,
    createdBy: decision.createdBy,
    createdAt: decision.createdAt,
  };
}

function serializeSuggestion(suggestion) {
  if (!suggestion) return null;
  return {
    id: suggestion._id.toString(),
    suggestedCategoryId: suggestion.suggestedCategoryId,
    suggestedSupplierId: suggestion.suggestedSupplierId,
    suggestedCost: suggestion.suggestedCost,
    suggestedDate: suggestion.suggestedDate,
    suggestedHistoricId: suggestion.suggestedHistoricId,
    suggestedWorkId: suggestion.suggestedWorkId,
    score: suggestion.score,
    reasonJson: suggestion.reasonJson,
  };
}

function resolveFinalValues(row, suggestion, decision) {
  const normalizedDecisionType = normalizeDecisionType(decision?.decisionType);
  if (decision && ["accepted", "edited"].includes(normalizedDecisionType)) {
    return {
      source: "decision",
      reviewStatus: normalizedDecisionType,
      categoryId: decision.finalCategoryId || null,
      supplierId: decision.finalSupplierId || null,
      cost: decision.finalCost ?? null,
      date: decision.finalDate || null,
      workId: decision.finalWorkId || null,
      notes: decision.finalNotes || "",
      measurements: decision.finalMeasurementsJson || null,
    };
  }

  if (suggestion) {
    return {
      source: "suggestion",
      reviewStatus: "pending",
      categoryId: suggestion.suggestedCategoryId || null,
      supplierId: suggestion.suggestedSupplierId || null,
      cost: suggestion.suggestedCost ?? row.rawJson?.normalized?.unitPrice ?? null,
      date: suggestion.suggestedDate || row.rawJson?.normalized?.dateIso || null,
      workId: suggestion.suggestedWorkId || null,
      notes: "",
      measurements: null,
    };
  }

  return {
    source: "empty",
    reviewStatus: "pending",
    categoryId: null,
    supplierId: null,
    cost: row.rawJson?.normalized?.unitPrice ?? null,
    date: row.rawJson?.normalized?.dateIso || null,
    workId: null,
      notes: "",
      measurements: row.rawJson?.normalized?.detectedDimensions
        ? {
            ...row.rawJson.normalized.detectedDimensions,
            applicationUnit: row.rawJson?.normalized?.suggestedApplicationUnit || null,
          }
        : null,
  };
}

function getReviewStatus(decision) {
  return decision ? normalizeDecisionType(decision.decisionType) : "pending";
}

function toSafeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function normalizeAnalysisUnit(value) {
  const normalized = normalizeUnit(value).normalized;
  if (SURFACE_ANALYSIS_UNITS.has(normalized)) return "m2";
  return normalized || null;
}

function getComparableAnalysis({ measurements, fallbackSuggestedUnit, originalPrice }) {
  if (!measurements) return null;
  const lengthM = toNumber(measurements.lengthM);
  const widthM = toNumber(measurements.widthM);
  const areaM2 = toNumber(measurements.areaM2 ?? (lengthM && widthM ? lengthM * widthM : null));
  const hasValidGeometry = Boolean(lengthM && widthM && areaM2 && areaM2 > 0);
  if (!hasValidGeometry) return null;

  const requestedUnit = normalizeAnalysisUnit(measurements.analysisUnit || measurements.applicationUnit || fallbackSuggestedUnit);
  if (requestedUnit !== "m2") return null;

  const normalizedPrice = toNumber(originalPrice);
  if (!normalizedPrice || normalizedPrice <= 0) return null;

  return {
    geometryMeta: {
      lengthM,
      widthM,
      areaM2,
      sourceUnit: measurements.sourceUnit || null,
    },
    analysisUnit: "m2",
    analysisUnitPrice: Number((normalizedPrice / areaM2).toFixed(6)),
  };
}

function buildConceptName(row) {
  return (row.rawConcept || "").trim() || row.rawJson?.normalized?.concept || "Concepto importado";
}

function getRowComparablePrice(row) {
  const rowUnitPrice = toSafeNumber(row.rawJson?.normalized?.unitPrice);
  const areaM2 = toSafeNumber(row.rawJson?.normalized?.detectedDimensions?.areaM2);
  const suggestedUnit = normalizeAnalysisUnit(row.rawJson?.normalized?.suggestedApplicationUnit);
  if (!rowUnitPrice || !areaM2 || areaM2 <= 0 || suggestedUnit !== "m2") {
    return { unit: null, price: rowUnitPrice };
  }

  return {
    unit: "m2",
    price: Number((rowUnitPrice / areaM2).toFixed(6)),
  };
}

function getCandidateComparablePrice(priceRecord, preferredUnit) {
  const candidateUnit = normalizeAnalysisUnit(priceRecord.analysisUnit);
  if (preferredUnit && candidateUnit === preferredUnit && toSafeNumber(priceRecord.analysisUnitPrice)) {
    return toSafeNumber(priceRecord.analysisUnitPrice);
  }
  return toSafeNumber(priceRecord.unitPrice) || toSafeNumber(priceRecord.normalizedPrice) || toSafeNumber(priceRecord.totalPrice);
}

async function resolveConceptForApply({ row, category, suggestedHistoric, actorUserId, mongoSession }) {
  if (suggestedHistoric?.conceptId) {
    const concept = await Concept.findById(suggestedHistoric.conceptId).session(mongoSession);
    if (concept) {
      return concept;
    }
  }

  const normalizedName = row.normalizedConcept || normalizeText(row.rawConcept).normalized;
  if (normalizedName) {
    const existing = await Concept.findOne({ normalizedName, categoryId: category._id, isActive: true }).session(mongoSession);
    if (existing) {
      return existing;
    }
  }

  const concept = await Concept.create(
    [
      {
        name: buildConceptName(row),
        normalizedName: normalizedName || normalizeText(buildConceptName(row)).normalized,
        categoryId: category._id,
        mainType: category.mainType,
        primaryUnit: row.rawJson?.normalized?.unit || row.rawUnit || "unidad",
        calculationType: "fixed_unit",
        requiresDimensions: false,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      },
    ],
    { session: mongoSession }
  );

  return concept[0];
}

async function detectPotentialDuplicate({ conceptId, categoryId, supplierId, priceDate, finalCost }) {
  const dayMs = 24 * 60 * 60 * 1000;
  const minDate = new Date(priceDate.getTime() - dayMs * 7);
  const maxDate = new Date(priceDate.getTime() + dayMs * 7);
  const minAmount = finalCost * 0.95;
  const maxAmount = finalCost * 1.05;

  const query = {
    conceptId,
    categoryId,
    priceDate: { $gte: minDate, $lte: maxDate },
    unitPrice: { $gte: minAmount, $lte: maxAmount },
  };
  if (supplierId) {
    query.supplierId = supplierId;
  }

  return PriceRecord.findOne(query).select("_id priceDate unitPrice").lean();
}

export async function generateImportSessionSuggestions(req, res) {
  const session = await ImportSession.findById(req.params.id);

  if (!session) {
    throw new AppError("Import session not found", 404);
  }

  const rows = await ImportRow.find({ sessionId: session.id }).lean();
  if (!rows.length) {
    throw new AppError("La sesión no tiene filas parseadas en staging", 400);
  }

  const candidateRows = rows.filter((row) => ["parsed", "warning"].includes(row.parseStatus));
  const rowsById = new Map(rows.map((row) => [String(row._id), row]));

  const conceptDocs = await Concept.find({ isActive: true }).select("_id name normalizedName categoryId primaryUnit").lean();
  const supplierDocs = await Supplier.find({ isActive: true }).select("_id name").lean();
  const categoryDocs = await Category.find({ isActive: true }).select("_id name").lean();
  const projectDocs = await Project.find({ isActive: true }).select("_id name").lean();

  const conceptById = new Map(conceptDocs.map((item) => [String(item._id), item]));
  const supplierById = new Map(supplierDocs.map((item) => [String(item._id), item]));
  const categoryById = new Map(categoryDocs.map((item) => [String(item._id), item]));
  const projectById = new Map(projectDocs.map((item) => [String(item._id), item]));
  const detectedSupplierName = session.detectedSupplierId ? supplierById.get(String(session.detectedSupplierId))?.name || "" : "";

  const conceptNormalizedMap = new Map(conceptDocs.map((concept) => [concept.normalizedName, concept]));

  const frequencyAgg = await PriceRecord.aggregate([
    { $group: { _id: { conceptId: "$conceptId", categoryId: "$categoryId" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const frequentCategoryByConcept = new Map();
  frequencyAgg.forEach((item) => {
    const conceptId = String(item._id?.conceptId || "");
    if (!conceptId || frequentCategoryByConcept.has(conceptId)) return;
    frequentCategoryByConcept.set(conceptId, {
      categoryId: item._id?.categoryId,
      count: item.count,
    });
  });

  const priceRecords = await PriceRecord.find({})
    .sort({ priceDate: -1 })
    .select("_id conceptId categoryId supplierId projectId priceDate unit unitPrice normalizedPrice totalPrice analysisUnit analysisUnitPrice")
    .lean();

  const suggestionDocs = [];
  const rowUpdates = [];
  const counters = { high: 0, medium: 0, low: 0, noMatch: 0 };

  rows.forEach((row) => {
    if (row.parseStatus === "error") {
      rowUpdates.push({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { matchStatus: "pending", confidenceScore: 0 } },
        },
      });
      counters.noMatch += 1;
      return;
    }

    if (!["parsed", "warning"].includes(row.parseStatus) || !row.normalizedConcept) {
      rowUpdates.push({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { matchStatus: "pending", confidenceScore: 0 } },
        },
      });
      counters.noMatch += 1;
      return;
    }

    const rowUnit = row.rawJson?.normalized?.unit || row.rawUnit;
    const rowSupplier = row.rawSupplier || detectedSupplierName || "";
    const rowComparable = getRowComparablePrice(row);
    const conceptFromCatalog = conceptNormalizedMap.get(row.normalizedConcept);

    const rankedCandidates = priceRecords
      .map((priceRecord) => {
        const concept = conceptById.get(String(priceRecord.conceptId || ""));
        const supplier = supplierById.get(String(priceRecord.supplierId || ""));

        const conceptSimilarity = conceptFromCatalog?._id && String(conceptFromCatalog._id) === String(concept?._id)
          ? 1
          : getConceptSimilarity(row.normalizedConcept, concept?.normalizedName || "");

        const unitScore = getUnitScore(rowComparable.unit || rowUnit, rowComparable.unit || priceRecord.analysisUnit || priceRecord.unit || concept?.primaryUnit || "");
        const supplierScore = getSupplierScore(rowSupplier, supplier?.name || "");
        const recencyScore = getRecencyScore(priceRecord.priceDate);
        const priceScore = getPriceCoherenceScore(rowComparable.price, getCandidateComparablePrice(priceRecord, rowComparable.unit));

        const finalScore =
          conceptSimilarity * 0.5 + unitScore * 0.15 + supplierScore * 0.15 + recencyScore * 0.1 + priceScore * 0.1;

        return {
          priceRecord,
          conceptSimilarity,
          unitScore,
          supplierScore,
          recencyScore,
          priceScore,
          finalScore,
        };
      })
      .filter((candidate) => candidate.conceptSimilarity >= 0.35)
      .sort((a, b) => b.finalScore - a.finalScore);

    const best = rankedCandidates[0];

    if (!best || best.finalScore < 0.5) {
      const fallbackDate = row.rawJson?.normalized?.dateIso || session.detectedDate || session.defaultDate || null;
      suggestionDocs.push({
        importRowId: row._id,
        suggestedSupplierId: row.rawSupplier ? null : session.detectedSupplierId || session.defaultSupplierId || null,
        suggestedWorkId: session.detectedWorkId || session.obraId || null,
        suggestedDate: fallbackDate,
        score: 0,
        reasonJson: {
          confidenceLabel: "low",
          reasons: ["Sin coincidencia confiable", "Se aplicaron defaults de contexto del documento cuando fue posible."],
          breakdown: { concept: 0, unit: 0, supplier: 0, recency: 0, coherence: 0 },
          matched: {
            supplierName: session.detectedSupplierId ? supplierById.get(String(session.detectedSupplierId))?.name || "" : "",
            workName: session.detectedWorkId ? projectById.get(String(session.detectedWorkId))?.name || "" : "",
          },
        },
      });
      rowUpdates.push({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { matchStatus: "pending", confidenceScore: 0 } },
        },
      });
      counters.noMatch += 1;
      return;
    }

    const suggestion = buildSuggestionPayload({
      row,
      candidate: best,
      conceptById,
      supplierById,
      categoryById,
      frequentCategoryByConcept,
    });
    if (!row.rawSupplier && !suggestion.suggestedSupplierId && (session.detectedSupplierId || session.defaultSupplierId)) {
      suggestion.suggestedSupplierId = session.detectedSupplierId || session.defaultSupplierId;
      suggestion.reasonJson.reasons.push("Proveedor sugerido desde contexto global del documento.");
      suggestion.reasonJson.matched.supplierName = supplierById.get(String(suggestion.suggestedSupplierId))?.name || "";
    }
    if (!suggestion.suggestedWorkId && (session.detectedWorkId || session.obraId)) {
      suggestion.suggestedWorkId = session.detectedWorkId || session.obraId;
      suggestion.reasonJson.reasons.push("Obra sugerida desde contexto global del documento.");
      suggestion.reasonJson.matched.workName = projectById.get(String(suggestion.suggestedWorkId))?.name || "";
    }
    if (!row.rawJson?.normalized?.dateIso && !suggestion.suggestedDate && (session.detectedDate || session.defaultDate)) {
      suggestion.suggestedDate = session.detectedDate || session.defaultDate;
      suggestion.reasonJson.reasons.push("Fecha sugerida desde contexto global del documento.");
    }

    suggestionDocs.push(suggestion);

    const confidenceLabel = classifyConfidence(suggestion.score);
    if (confidenceLabel === "high") counters.high += 1;
    else if (confidenceLabel === "medium") counters.medium += 1;
    else counters.low += 1;

    rowUpdates.push({
      updateOne: {
        filter: { _id: row._id },
        update: {
          $set: {
            matchStatus: "suggested",
            confidenceScore: suggestion.score,
          },
        },
      },
    });
  });

  const rowIds = rows.map((row) => row._id);
  await ImportRowSuggestion.deleteMany({ importRowId: { $in: rowIds } });
  if (suggestionDocs.length) {
    await ImportRowSuggestion.insertMany(suggestionDocs, { ordered: false });
  }
  if (rowUpdates.length) {
    await ImportRow.bulkWrite(rowUpdates);
  }

  session.status = "reviewing";
  session.optionsJson = {
    ...(session.optionsJson || {}),
    suggestionSummary: {
      totalRows: rows.length,
      candidateRows: candidateRows.length,
      high: counters.high,
      medium: counters.medium,
      low: counters.low,
      noMatch: counters.noMatch,
    },
    lastSuggestedAt: new Date().toISOString(),
  };
  await session.save();

  const createdSuggestions = await ImportRowSuggestion.find({ importRowId: { $in: rowIds } })
    .sort({ score: -1 })
    .limit(10)
    .lean();

  res.json({
    summary: {
      totalRows: rows.length,
      candidateRows: candidateRows.length,
      high: counters.high,
      medium: counters.medium,
      low: counters.low,
      noMatch: counters.noMatch,
    },
    sample: createdSuggestions.map((item) => {
      const row = rowsById.get(String(item.importRowId));
      return {
        importRowId: item.importRowId,
        sheetRowNumber: row?.sheetRowNumber,
        concept: row?.rawConcept,
        score: item.score,
        confidenceLabel: item.reasonJson?.confidenceLabel || classifyConfidence(item.score || 0),
        reasons: item.reasonJson?.reasons || [],
      };
    }),
    item: serializeSession(session),
  });
}

export async function listImportRows(req, res) {
  const session = await ImportSession.findById(req.params.id).select("_id obraId defaultDate defaultSupplierId detectedWorkId detectedDate detectedSupplierId");

  if (!session) {
    throw new AppError("Import session not found", 404);
  }

  const parseStatusFilter = req.query.parseStatus?.toString();
  const reviewStatusFilter = req.query.reviewStatus?.toString();
  const confidenceFilter = req.query.confidence?.toString();
  const query = { sessionId: session.id };

  if (parseStatusFilter) {
    query.parseStatus = parseStatusFilter;
  }

  const items = await ImportRow.find(query).sort({ sheetRowNumber: 1, createdAt: 1 }).lean();
  const rowIds = items.map((row) => row._id);
  const suggestionItems = await ImportRowSuggestion.find({ importRowId: { $in: rowIds } })
    .sort({ createdAt: -1 })
    .lean();
  const decisionItems = await ImportRowDecision.find({ importRowId: { $in: rowIds } }).lean();

  const suggestionByRowId = new Map();
  suggestionItems.forEach((suggestion) => {
    suggestionByRowId.set(String(suggestion.importRowId), suggestion);
  });
  const decisionByRowId = new Map();
  decisionItems.forEach((decision) => {
    decisionByRowId.set(String(decision.importRowId), decision);
  });

  const composed = items.map((row) => {
    const suggestion = suggestionByRowId.get(String(row._id)) || null;
    const decision = decisionByRowId.get(String(row._id)) || null;
    const serializedSuggestion = serializeSuggestion(suggestion);
    const serializedDecision = serializeDecision(decision);
    const reviewStatus = getReviewStatus(decision);
    const confidenceLabel = serializedSuggestion?.reasonJson?.confidenceLabel || "no_match";
    const sessionFallbackDate = session.detectedDate || session.defaultDate || null;
    const sessionFallbackSupplier = session.detectedSupplierId || session.defaultSupplierId || null;
    const sessionFallbackWork = session.detectedWorkId || session.obraId || null;
    if (serializedSuggestion) {
      if (!serializedSuggestion.suggestedSupplierId && !row.rawSupplier && sessionFallbackSupplier) {
        serializedSuggestion.suggestedSupplierId = sessionFallbackSupplier;
      }
      if (!serializedSuggestion.suggestedWorkId && sessionFallbackWork) {
        serializedSuggestion.suggestedWorkId = sessionFallbackWork;
      }
      if (!serializedSuggestion.suggestedDate && !row.rawJson?.normalized?.dateIso && sessionFallbackDate) {
        serializedSuggestion.suggestedDate = sessionFallbackDate;
      }
    }
    const finalValues = resolveFinalValues(row, serializedSuggestion, serializedDecision);
    if (!finalValues.supplierId && !row.rawSupplier && sessionFallbackSupplier) {
      finalValues.supplierId = sessionFallbackSupplier;
    }
    if (!finalValues.workId && sessionFallbackWork) {
      finalValues.workId = sessionFallbackWork;
    }
    if (!finalValues.date && sessionFallbackDate) {
      finalValues.date = sessionFallbackDate;
    }
    return {
      id: row._id.toString(),
      sessionId: row.sessionId,
      sheetRowNumber: row.sheetRowNumber,
      rawJson: row.rawJson,
      rawConcept: row.rawConcept,
      rawUnit: row.rawUnit,
      rawQuantity: row.rawQuantity,
      rawUnitPrice: row.rawUnitPrice,
      rawAmount: row.rawAmount,
      rawSupplier: row.rawSupplier,
      rawDate: row.rawDate,
      rawCategory: row.rawCategory,
      normalizedConcept: row.normalizedConcept,
      parseStatus: row.parseStatus,
      matchStatus: row.matchStatus,
      confidenceScore: row.confidenceScore,
      confidenceLabel,
      reviewStatus,
      suggestion: serializedSuggestion,
      decision: serializedDecision,
      finalValues,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });

  const filtered = composed.filter((row) => {
    if (reviewStatusFilter && row.reviewStatus !== reviewStatusFilter) return false;
    if (confidenceFilter && row.confidenceLabel !== confidenceFilter) return false;
    return true;
  });

  const counters = {
    total: composed.length,
    pending: composed.filter((row) => row.reviewStatus === "pending").length,
    accepted: composed.filter((row) => row.reviewStatus === "accepted").length,
    edited: composed.filter((row) => row.reviewStatus === "edited").length,
    ignored: composed.filter((row) => row.reviewStatus === "ignored").length,
    high: composed.filter((row) => row.confidenceLabel === "high").length,
    medium: composed.filter((row) => row.confidenceLabel === "medium").length,
    low: composed.filter((row) => row.confidenceLabel === "low").length,
    noMatch: composed.filter((row) => row.confidenceLabel === "no_match").length,
  };

  res.json({
    counters,
    items: filtered,
  });
}

export async function saveImportRowDecision(req, res) {
  const { decision, reviewStatus } = await upsertRowDecision({
    rowId: req.params.id,
    payload: req.validatedBody,
    userId: req.user.id,
  });

  res.json({
    item: serializeDecision(decision),
    reviewStatus,
  });
}

export async function bulkSaveImportRowDecisions(req, res) {
  const session = await ImportSession.findById(req.params.id).select("_id");
  if (!session) {
    throw new AppError("Import session not found", 404);
  }

  const { action, rowIds = [], categoryId = null, supplierId = null } = req.body || {};
  const normalizedCategoryId = normalizeObjectIdInput(categoryId);
  const normalizedSupplierId = normalizeObjectIdInput(supplierId);
  if (!Array.isArray(rowIds) || !rowIds.length) {
    throw new AppError("Debes enviar al menos una fila para acción masiva", 400);
  }

  const rows = await ImportRow.find({ _id: { $in: rowIds }, sessionId: session.id }).select("_id");
  if (!rows.length) {
    throw new AppError("No se encontraron filas válidas para la sesión", 400);
  }

  let decisionType = "edited";
  if (action === "accept") decisionType = "accepted";
  if (action === "ignore") decisionType = "ignored";
  if (!["accept", "ignore", "set_supplier", "set_category"].includes(action)) {
    throw new AppError("Acción masiva no soportada", 400);
  }
  if (action === "set_category" && !normalizedCategoryId) {
    throw new AppError("Categoría masiva inválida", 400);
  }
  if (action === "set_supplier" && !normalizedSupplierId) {
    throw new AppError("Proveedor masivo inválido", 400);
  }

  const results = [];
  for (const row of rows) {
    const currentDecision = await ImportRowDecision.findOne({ importRowId: row.id }).lean();
    const payload = {
      decisionType,
      finalCategoryId: currentDecision?.finalCategoryId || null,
      finalSupplierId: currentDecision?.finalSupplierId || null,
      finalCost: currentDecision?.finalCost ?? null,
      finalDate: currentDecision?.finalDate ? new Date(currentDecision.finalDate).toISOString() : null,
      finalWorkId: currentDecision?.finalWorkId || null,
      finalNotes: currentDecision?.finalNotes || "",
    };

    if (action === "set_supplier") {
      payload.finalSupplierId = normalizedSupplierId;
      payload.decisionType = "edited";
    }
    if (action === "set_category") {
      payload.finalCategoryId = normalizedCategoryId;
      payload.decisionType = "edited";
    }

    const result = await upsertRowDecision({
      rowId: row.id.toString(),
      payload,
      userId: req.user.id,
    });
    results.push(serializeDecision(result.decision));
  }

  res.json({ updated: results.length, items: results });
}

async function upsertRowDecision({ rowId, payload, userId }) {
  const row = await ImportRow.findById(rowId).select("_id matchStatus parseStatus rawJson");
  if (!row) {
    throw new AppError("Import row not found", 404);
  }

  const normalizedDecisionType = normalizeDecisionType(payload.decisionType);
  const suggestion = await ImportRowSuggestion.findOne({ importRowId: row.id }).lean();
  const currentDecision = await ImportRowDecision.findOne({ importRowId: row.id }).lean();

  if (normalizedDecisionType === "accepted" && row.parseStatus === "error") {
    throw new AppError("Las filas con error de parseo no se pueden aceptar. Puedes ignorarlas o editarlas.", 400);
  }

  if (normalizedDecisionType === "new") {
    await ImportRowDecision.deleteOne({ importRowId: row.id });
    row.matchStatus = suggestion ? "suggested" : "pending";
    await row.save();
    return { decision: null, reviewStatus: "pending" };
  }

  const decisionPayload = {
    importRowId: row.id,
    decisionType: normalizedDecisionType,
    finalCategoryId: normalizeObjectIdInput(payload.finalCategoryId),
    finalSupplierId: normalizeObjectIdInput(payload.finalSupplierId),
    finalCost: payload.finalCost ?? null,
    finalDate: payload.finalDate ? new Date(payload.finalDate) : null,
    finalWorkId: normalizeObjectIdInput(payload.finalWorkId),
    finalNotes: payload.finalNotes || currentDecision?.finalNotes || "",
    finalMeasurementsJson: payload.finalMeasurementsJson ?? null,
    createdBy: userId,
  };

  if (currentDecision) {
    decisionPayload.finalCategoryId = decisionPayload.finalCategoryId || currentDecision.finalCategoryId || null;
    decisionPayload.finalSupplierId = decisionPayload.finalSupplierId || currentDecision.finalSupplierId || null;
    decisionPayload.finalCost = decisionPayload.finalCost ?? currentDecision.finalCost ?? null;
    decisionPayload.finalDate = decisionPayload.finalDate || currentDecision.finalDate || null;
    decisionPayload.finalWorkId = decisionPayload.finalWorkId || currentDecision.finalWorkId || null;
    decisionPayload.finalMeasurementsJson = decisionPayload.finalMeasurementsJson ?? currentDecision.finalMeasurementsJson ?? null;
  }

  if (normalizedDecisionType === "accepted") {
    decisionPayload.finalCategoryId = normalizeObjectIdInput(suggestion?.suggestedCategoryId) || decisionPayload.finalCategoryId;
    decisionPayload.finalSupplierId = normalizeObjectIdInput(suggestion?.suggestedSupplierId) || decisionPayload.finalSupplierId;
    decisionPayload.finalCost = suggestion?.suggestedCost ?? row.rawJson?.normalized?.unitPrice ?? decisionPayload.finalCost;
    decisionPayload.finalDate = suggestion?.suggestedDate || decisionPayload.finalDate;
    decisionPayload.finalWorkId = normalizeObjectIdInput(suggestion?.suggestedWorkId) || decisionPayload.finalWorkId;
    if (!decisionPayload.finalMeasurementsJson && row.rawJson?.normalized?.detectedDimensions) {
      decisionPayload.finalMeasurementsJson = {
        ...row.rawJson.normalized.detectedDimensions,
        applicationUnit: row.rawJson?.normalized?.suggestedApplicationUnit || null,
      };
    }
  }

  const decision = await ImportRowDecision.findOneAndUpdate({ importRowId: row.id }, decisionPayload, {
    upsert: true,
    new: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  });

  row.matchStatus = normalizedDecisionType === "ignored" ? "ignored" : normalizedDecisionType;
  await row.save();

  return { decision, reviewStatus: normalizedDecisionType };
}

export async function applyImportSession(req, res) {
  const session = await ImportSession.findById(req.params.id);

  if (!session) {
    throw new AppError("Import session not found", 404);
  }

  if (session.status === "failed") {
    throw new AppError("Import session cannot be applied in current status", 400);
  }

  const decisions = await ImportRowDecision.find({ importRowId: { $exists: true } }).lean();
  const decisionIds = decisions.map((item) => item.importRowId);
  const rows = await ImportRow.find({ _id: { $in: decisionIds }, sessionId: session.id }).lean();
  const rowsById = new Map(rows.map((item) => [String(item._id), item]));
  const scopedDecisions = decisions.filter((item) => rowsById.has(String(item.importRowId)));

  if (!scopedDecisions.length) {
    throw new AppError("La sesión no tiene decisiones guardadas para aplicar", 400);
  }

  const suggestionRows = await ImportRowSuggestion.find({ importRowId: { $in: rows.map((item) => item._id) } })
    .select("importRowId suggestedHistoricId")
    .lean();
  const suggestionByRowId = new Map(suggestionRows.map((item) => [String(item.importRowId), item]));
  const categoryIds = [
    ...new Set(
      scopedDecisions
        .map((item) => normalizeObjectIdInput(item.finalCategoryId))
        .filter(Boolean)
        .map(String)
    ),
  ];
  const categoryDocs = await Category.find({ _id: { $in: categoryIds } }).select("_id mainType").lean();
  const categoryById = new Map(categoryDocs.map((item) => [String(item._id), item]));
  const projectIds = [...new Set(scopedDecisions.map((item) => item.finalWorkId).filter(Boolean).map(String))];
  const projectDocs = projectIds.length ? await Project.find({ _id: { $in: projectIds } }).select("_id name isActive").lean() : [];
  const projectById = new Map(projectDocs.map((item) => [String(item._id), item]));

  const summary = {
    totalReviewed: scopedDecisions.length,
    eligible: 0,
    applied: 0,
    omitted: 0,
    errors: 0,
    duplicateWarnings: 0,
    alreadyApplied: 0,
    createdIds: [],
    warnings: [],
    errorRows: [],
  };

  const mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      for (const decision of scopedDecisions) {
        const row = rowsById.get(String(decision.importRowId));
        if (!row) {
          summary.omitted += 1;
          continue;
        }

        const normalizedDecisionType = normalizeDecisionType(decision.decisionType);
        if (!["accepted", "edited"].includes(normalizedDecisionType)) {
          summary.omitted += 1;
          continue;
        }
        summary.eligible += 1;

        if (decision.savedHistoricId) {
          summary.alreadyApplied += 1;
          summary.omitted += 1;
          summary.createdIds.push(String(decision.savedHistoricId));
          continue;
        }

        const finalCategoryId = normalizeObjectIdInput(decision.finalCategoryId);
        const finalCost = toNumber(decision.finalCost);
        const inferredDateFromYear = session.detectedYear ? getContextDateFromYear(session.detectedYear) : null;
        const finalDate = toSafeDate(
          decision.finalDate || row.rawJson?.normalized?.dateIso || session.detectedDate || session.defaultDate || inferredDateFromYear
        );
        const finalSupplierId =
          normalizeObjectIdInput(decision.finalSupplierId) ||
          normalizeObjectIdInput(session.detectedSupplierId) ||
          normalizeObjectIdInput(session.defaultSupplierId) ||
          null;
        const finalProjectId =
          normalizeObjectIdInput(decision.finalWorkId) ||
          normalizeObjectIdInput(session.detectedWorkId) ||
          normalizeObjectIdInput(session.obraId) ||
          null;

        if (!finalCategoryId || !categoryById.get(String(finalCategoryId))) {
          summary.errors += 1;
          summary.errorRows.push({
            importRowId: row._id,
            sheetRowNumber: row.sheetRowNumber,
            reason: "Categoría final inválida",
            debug: {
              finalCategoryId: decision.finalCategoryId ?? null,
              normalizedFinalCategoryId: finalCategoryId ?? null,
              categoryFound: Boolean(finalCategoryId && categoryById.get(String(finalCategoryId))),
            },
          });
          continue;
        }
        if (finalCost === null || finalCost <= 0) {
          summary.errors += 1;
          summary.errorRows.push({ importRowId: row._id, sheetRowNumber: row.sheetRowNumber, reason: "Costo final inválido" });
          continue;
        }
        if (!finalDate) {
          summary.errors += 1;
          summary.errorRows.push({ importRowId: row._id, sheetRowNumber: row.sheetRowNumber, reason: "Fecha final inválida o no resoluble" });
          continue;
        }
        if (row.parseStatus === "error" && normalizedDecisionType !== "edited") {
          summary.errors += 1;
          summary.errorRows.push({
            importRowId: row._id,
            sheetRowNumber: row.sheetRowNumber,
            reason: "Fila con parseStatus=error requiere corrección explícita",
          });
          continue;
        }

        const project = finalProjectId ? projectById.get(String(finalProjectId)) : null;
        if (project && !project.isActive) {
          summary.errors += 1;
          summary.errorRows.push({ importRowId: row._id, sheetRowNumber: row.sheetRowNumber, reason: "Obra final inactiva" });
          continue;
        }

        const suggestion = suggestionByRowId.get(String(row._id));
        const suggestedHistoric = suggestion?.suggestedHistoricId
          ? await PriceRecord.findById(suggestion.suggestedHistoricId).select("_id conceptId unit").session(mongoSession)
          : null;
        const category = categoryById.get(String(finalCategoryId));
        const concept = await resolveConceptForApply({
          row,
          category,
          suggestedHistoric,
          actorUserId: req.user.id,
          mongoSession,
        });

        const duplicate = await detectPotentialDuplicate({
          conceptId: concept._id,
          categoryId: finalCategoryId,
          supplierId: finalSupplierId,
          priceDate: finalDate,
          finalCost,
        });
        if (duplicate) {
          summary.duplicateWarnings += 1;
          summary.warnings.push({
            importRowId: row._id,
            sheetRowNumber: row.sheetRowNumber,
            duplicateHistoricId: duplicate._id,
            reason: "Posible duplicado por concepto/costo/fecha/proveedor",
          });
        }

        const money = parseMoneyInput(finalCost);
        const commercialUnit = row.rawJson?.normalized?.unit || row.rawUnit || suggestedHistoric?.unit || concept.primaryUnit || "unidad";
        const measurements = decision.finalMeasurementsJson || null;
        const comparable = getComparableAnalysis({
          measurements,
          fallbackSuggestedUnit: row.rawJson?.normalized?.suggestedApplicationUnit || null,
          originalPrice: money.normalizedAmount,
        });
        const created = await PriceRecord.create(
          [
            {
              mainType: concept.mainType || category.mainType,
              categoryId: finalCategoryId,
              conceptId: concept._id,
              supplierId: finalSupplierId,
              projectId: finalProjectId,
              unit: commercialUnit,
              priceDate: finalDate,
              pricingMode: "unit_price",
              originalAmount: money.normalizedAmount,
              originalAmountCents: money.cents,
              capturedAmount: money.normalizedString,
              unitPrice: money.normalizedAmount,
              totalPrice: null,
              projectNameSnapshot: project?.name || "",
              observations: decision.finalNotes || row.rawJson?.observations || "",
              normalizedQuantity: comparable?.geometryMeta?.areaM2 || row.rawJson?.normalized?.quantity ?? null,
              normalizedUnit: comparable?.analysisUnit || row.rawJson?.normalized?.unit || null,
              normalizedPrice: comparable?.analysisUnitPrice || money.normalizedAmount,
              geometryMeta: comparable?.geometryMeta || null,
              commercialUnit,
              commercialUnitPrice: money.normalizedAmount,
              analysisUnit: comparable?.analysisUnit || null,
              analysisUnitPrice: comparable?.analysisUnitPrice || null,
              attributes: {
                importMeta: {
                  sessionId: session.id,
                  importRowId: row._id,
                  fileName: session.fileName,
                  rowNumber: row.sheetRowNumber,
                  rawValues: row.rawJson?.rowValues || [],
                  finalMeasurements: decision.finalMeasurementsJson || null,
                  analyticComparable: comparable || null,
                },
              },
              sourceImportSessionId: session.id,
              sourceImportRowId: row._id,
              sourceFileName: session.fileName || "",
              captureOrigin: "excel_import",
              createdBy: req.user.id,
              updatedBy: req.user.id,
            },
          ],
          { session: mongoSession }
        );
        const createdRecord = created[0];

        await ImportRowDecision.updateOne(
          { _id: decision._id },
          { $set: { savedHistoricId: createdRecord._id } },
          { session: mongoSession }
        );

        summary.applied += 1;
        summary.createdIds.push(String(createdRecord._id));
      }

      session.status = "confirmed";
      session.optionsJson = {
        ...(session.optionsJson || {}),
        applySummary: {
          appliedAt: new Date().toISOString(),
          totalReviewed: summary.totalReviewed,
          eligible: summary.eligible,
          applied: summary.applied,
          omitted: summary.omitted,
          errors: summary.errors,
          duplicateWarnings: summary.duplicateWarnings,
          alreadyApplied: summary.alreadyApplied,
        },
      };
      await session.save({ session: mongoSession });
    });
  } finally {
    await mongoSession.endSession();
  }

  res.json({
    summary,
    item: serializeSession(session),
  });
}

import { ImportSession } from "../models/ImportSession.js";
import { ImportRow } from "../models/ImportRow.js";
import { ImportRowDecision } from "../models/ImportRowDecision.js";
import { ImportRowSuggestion } from "../models/ImportRowSuggestion.js";
import { Concept } from "../models/Concept.js";
import { PriceRecord } from "../models/PriceRecord.js";
import { Supplier } from "../models/Supplier.js";
import { Category } from "../models/Category.js";
import { AppError } from "../utils/AppError.js";
import {
  getWorkbookPreview,
  getWorkbookSheetRows,
  getWorkbookSheets,
  resolveStoredFilePath,
  storeImportFile,
} from "../services/importWorkbookService.js";
import {
  getMappedCell,
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

  const { detectedHeaderRowIndex, detectedDataStartRowIndex, detectedMapping, columns } = detectHeaderAndMapping(preview.rows || []);

  res.json({
    item: {
      sheetName: preview.sheet,
      totalRowsWithContent: preview.rowCount || 0,
      rows: preview.rows || [],
      columns,
      detectedHeaderRowIndex,
      detectedDataStartRowIndex,
      detectedMapping,
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

  const conceptById = new Map(conceptDocs.map((item) => [String(item._id), item]));
  const supplierById = new Map(supplierDocs.map((item) => [String(item._id), item]));
  const categoryById = new Map(categoryDocs.map((item) => [String(item._id), item]));

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
    .select("_id conceptId categoryId supplierId projectId priceDate unit unitPrice normalizedPrice totalPrice")
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
    const rowSupplier = row.rawSupplier || "";
    const rowUnitPrice = row.rawJson?.normalized?.unitPrice;
    const conceptFromCatalog = conceptNormalizedMap.get(row.normalizedConcept);

    const rankedCandidates = priceRecords
      .map((priceRecord) => {
        const concept = conceptById.get(String(priceRecord.conceptId || ""));
        const supplier = supplierById.get(String(priceRecord.supplierId || ""));

        const conceptSimilarity = conceptFromCatalog?._id && String(conceptFromCatalog._id) === String(concept?._id)
          ? 1
          : getConceptSimilarity(row.normalizedConcept, concept?.normalizedName || "");

        const unitScore = getUnitScore(rowUnit, priceRecord.unit || concept?.primaryUnit || "");
        const supplierScore = getSupplierScore(rowSupplier, supplier?.name || "");
        const recencyScore = getRecencyScore(priceRecord.priceDate);
        const priceScore = getPriceCoherenceScore(rowUnitPrice, priceRecord.unitPrice || priceRecord.normalizedPrice || priceRecord.totalPrice);

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
      suggestionDocs.push({
        importRowId: row._id,
        score: 0,
        reasonJson: {
          confidenceLabel: "low",
          reasons: ["Sin coincidencia confiable"],
          breakdown: { concept: 0, unit: 0, supplier: 0, recency: 0, coherence: 0 },
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
  const session = await ImportSession.findById(req.params.id).select("_id");

  if (!session) {
    throw new AppError("Import session not found", 404);
  }

  const parseStatusFilter = req.query.parseStatus?.toString();
  const query = { sessionId: session.id };

  if (parseStatusFilter) {
    query.parseStatus = parseStatusFilter;
  }

  const items = await ImportRow.find(query).sort({ sheetRowNumber: 1, createdAt: 1 }).lean();
  const suggestionItems = await ImportRowSuggestion.find({ importRowId: { $in: items.map((row) => row._id) } })
    .sort({ createdAt: -1 })
    .lean();

  const suggestionByRowId = new Map();
  suggestionItems.forEach((suggestion) => {
    suggestionByRowId.set(String(suggestion.importRowId), suggestion);
  });

  res.json({
    items: items.map((row) => ({
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
      suggestion: suggestionByRowId.has(String(row._id))
        ? {
            id: suggestionByRowId.get(String(row._id))._id.toString(),
            suggestedCategoryId: suggestionByRowId.get(String(row._id)).suggestedCategoryId,
            suggestedSupplierId: suggestionByRowId.get(String(row._id)).suggestedSupplierId,
            suggestedCost: suggestionByRowId.get(String(row._id)).suggestedCost,
            suggestedDate: suggestionByRowId.get(String(row._id)).suggestedDate,
            suggestedHistoricId: suggestionByRowId.get(String(row._id)).suggestedHistoricId,
            suggestedWorkId: suggestionByRowId.get(String(row._id)).suggestedWorkId,
            score: suggestionByRowId.get(String(row._id)).score,
            reasonJson: suggestionByRowId.get(String(row._id)).reasonJson,
          }
        : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
  });
}

export async function saveImportRowDecision(req, res) {
  const row = await ImportRow.findById(req.params.id).select("_id matchStatus parseStatus");

  if (!row) {
    throw new AppError("Import row not found", 404);
  }

  const decisionPayload = {
    ...req.validatedBody,
    finalDate: req.validatedBody.finalDate ? new Date(req.validatedBody.finalDate) : null,
  };

  const decision = await ImportRowDecision.findOneAndUpdate(
    { importRowId: row.id },
    {
      ...decisionPayload,
      importRowId: row.id,
      createdBy: req.user.id,
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  row.matchStatus = req.validatedBody.decisionType === "ignore" ? "ignored" : "accepted";
  await row.save();

  res.json({
    item: {
      id: decision.id,
      importRowId: decision.importRowId,
      decisionType: decision.decisionType,
      finalCategoryId: decision.finalCategoryId,
      finalSupplierId: decision.finalSupplierId,
      finalCost: decision.finalCost,
      finalDate: decision.finalDate,
      finalWorkId: decision.finalWorkId,
      finalNotes: decision.finalNotes,
      savedHistoricId: decision.savedHistoricId,
      createdBy: decision.createdBy,
      createdAt: decision.createdAt,
    },
  });
}

export async function applyImportSession(req, res) {
  const session = await ImportSession.findById(req.params.id);

  if (!session) {
    throw new AppError("Import session not found", 404);
  }

  if (["failed", "confirmed"].includes(session.status)) {
    throw new AppError("Import session cannot be applied in current status", 400);
  }

  session.status = "reviewing";
  await session.save();

  res.status(202).json({
    message: "Apply endpoint listo en modo stub. La persistencia a históricos se habilitará en la siguiente fase.",
    item: serializeSession(session),
  });
}

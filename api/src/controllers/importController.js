import { ImportSession } from "../models/ImportSession.js";
import { ImportRow } from "../models/ImportRow.js";
import { ImportRowDecision } from "../models/ImportRowDecision.js";
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

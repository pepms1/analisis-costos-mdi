import { ImportSession } from "../models/ImportSession.js";
import { ImportRow } from "../models/ImportRow.js";
import { ImportRowDecision } from "../models/ImportRowDecision.js";
import { AppError } from "../utils/AppError.js";
import {
  getWorkbookPreview,
  getWorkbookSheets,
  resolveStoredFilePath,
  storeImportFile,
} from "../services/importWorkbookService.js";

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

export async function listImportRows(req, res) {
  const session = await ImportSession.findById(req.params.id).select("_id");

  if (!session) {
    throw new AppError("Import session not found", 404);
  }

  const items = await ImportRow.find({ sessionId: session.id }).sort({ sheetRowNumber: 1, createdAt: 1 }).lean();

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

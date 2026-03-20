import { ImportSession } from "../models/ImportSession.js";
import { ImportRow } from "../models/ImportRow.js";
import { ImportRowDecision } from "../models/ImportRowDecision.js";
import { AppError } from "../utils/AppError.js";

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

export async function getImportSession(req, res) {
  const session = await ImportSession.findById(req.params.id).lean();

  if (!session) {
    throw new AppError("Import session not found", 404);
  }

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

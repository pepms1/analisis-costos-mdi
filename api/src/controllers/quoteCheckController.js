import { AdjustmentSetting } from "../models/AdjustmentSetting.js";
import { Concept } from "../models/Concept.js";
import { PriceRecord } from "../models/PriceRecord.js";
import { QuoteCheck } from "../models/QuoteCheck.js";
import { AppError } from "../utils/AppError.js";
import { applyAdjustment, classifyQuote } from "../utils/quoteCheck.js";
import { toMeters } from "../utils/normalization.js";

function normalizeDimensions(dimensions = {}) {
  if (!dimensions) return { largo: null, ancho: null, area: null };

  const measurementUnit = dimensions.measurementUnit || "cm";
  const largoRaw = dimensions.largo ?? dimensions.length ?? dimensions.width;
  let anchoRaw = dimensions.ancho ?? dimensions.height;

  if (anchoRaw === undefined || anchoRaw === null) {
    anchoRaw = largoRaw === dimensions.width ? dimensions.length ?? null : dimensions.width ?? null;
  }

  const largo = toMeters(largoRaw, measurementUnit);
  const ancho = toMeters(anchoRaw, measurementUnit);

  return {
    largo,
    ancho,
    area: largo && ancho ? largo * ancho : null,
  };
}

function isDimensionalConcept(concept) {
  return concept?.requiresDimensions || ["area_based", "linear_based", "height_based"].includes(concept?.calculationType);
}

export async function listQuoteChecks(_req, res) {
  const items = await QuoteCheck.find().populate("conceptId", "name").sort({ createdAt: -1 });

  res.json({
    items: items.map((item) => ({
      id: item.id,
      conceptName: item.conceptId?.name || "—",
      historicalPrice: item.historicalPrice,
      adjustedPrice: item.adjustedPrice,
      quotedPrice: item.quotedPrice,
      differencePercent: item.differencePercent,
      result: item.result,
      baseDimensions: item.baseDimensions,
      targetDimensions: item.targetDimensions,
      baseAreaM2: item.baseAreaM2,
      targetAreaM2: item.targetAreaM2,
      proportionalEstimatedPrice: item.proportionalEstimatedPrice,
    })),
  });
}

export async function createQuoteCheck(req, res) {
  const { conceptId, supplierId, quotedPrice, targetDate, dimensions } = req.validatedBody;

  const concept = await Concept.findById(conceptId);

  if (!concept) {
    throw new AppError("Concept not found", 404);
  }

  const query = { conceptId };
  if (supplierId) {
    query.supplierId = supplierId;
  }

  const dimensional = isDimensionalConcept(concept);
  const referenceRecord = dimensional
    ? await PriceRecord.findOne({
        ...query,
        normalizedPrice: { $gt: 0 },
        normalizedQuantity: { $gt: 0 },
      }).sort({ priceDate: -1, createdAt: -1 })
    : await PriceRecord.findOne(query).sort({ priceDate: -1, createdAt: -1 });

  if (!referenceRecord) {
    throw new AppError("No historical record found for the selected filters", 404);
  }

  const applicableAdjustments = await AdjustmentSetting.find({
    isActive: true,
    $or: [
      { scopeType: "general" },
      { scopeType: concept.mainType },
      { scopeType: "category", categoryId: concept.categoryId },
    ],
  });

  const factors = applicableAdjustments.flatMap((setting) => setting.factors);
  const basePrice = dimensional
    ? referenceRecord.normalizedPrice
    : referenceRecord.normalizedPrice || referenceRecord.unitPrice || referenceRecord.totalPrice;
  const adjustedPrice = applyAdjustment(basePrice, factors);

  const base = normalizeDimensions(referenceRecord.dimensions);
  const target = normalizeDimensions(dimensions);

  const proportionalEstimatedPrice =
    dimensional && adjustedPrice && target.area
      ? adjustedPrice * target.area
      : adjustedPrice;

  if (dimensional && !target.area) {
    throw new AppError("Dimensional concepts require largo and ancho", 400);
  }

  const comparison = classifyQuote(proportionalEstimatedPrice, quotedPrice);

  const item = await QuoteCheck.create({
    conceptId,
    supplierId: supplierId || null,
    referencePriceRecordId: referenceRecord.id,
    historicalPrice: basePrice,
    adjustedPrice,
    quotedPrice,
    differenceAbsolute: comparison.differenceAbsolute,
    differencePercent: comparison.differencePercent,
    result: comparison.result,
    targetDate,
    createdBy: req.user.id,
    baseDimensions: referenceRecord.dimensions || null,
    targetDimensions: dimensions || null,
    baseAreaM2: referenceRecord.normalizedQuantity || base.area,
    targetAreaM2: target.area,
    proportionalEstimatedPrice,
  });

  res.status(201).json({ item });
}

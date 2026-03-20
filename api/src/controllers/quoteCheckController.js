import { AdjustmentSetting } from "../models/AdjustmentSetting.js";
import { Concept } from "../models/Concept.js";
import { PriceRecord } from "../models/PriceRecord.js";
import { QuoteCheck } from "../models/QuoteCheck.js";
import { AppError } from "../utils/AppError.js";
import { applyAdjustment, classifyQuote } from "../utils/quoteCheck.js";

export async function listQuoteChecks(_req, res) {
  const items = await QuoteCheck.find()
    .populate("conceptId", "name")
    .sort({ createdAt: -1 });

  res.json({
    items: items.map((item) => ({
      id: item.id,
      conceptName: item.conceptId?.name || "—",
      historicalPrice: item.historicalPrice,
      adjustedPrice: item.adjustedPrice,
      quotedPrice: item.quotedPrice,
      differencePercent: item.differencePercent,
      result: item.result,
    })),
  });
}

export async function createQuoteCheck(req, res) {
  const { conceptId, supplierId, quotedPrice, targetDate } = req.validatedBody;

  const concept = await Concept.findById(conceptId);

  if (!concept) {
    throw new AppError("Concept not found", 404);
  }

  const query = { conceptId };
  if (supplierId) {
    query.supplierId = supplierId;
  }

  const referenceRecord = await PriceRecord.findOne(query).sort({ priceDate: -1, createdAt: -1 });

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
  const historicalPrice = referenceRecord.normalizedPrice || referenceRecord.unitPrice || referenceRecord.totalPrice;
  const adjustedPrice = applyAdjustment(historicalPrice, factors);
  const comparison = classifyQuote(adjustedPrice, quotedPrice);

  const item = await QuoteCheck.create({
    conceptId,
    supplierId: supplierId || null,
    referencePriceRecordId: referenceRecord.id,
    historicalPrice,
    adjustedPrice,
    quotedPrice,
    differenceAbsolute: comparison.differenceAbsolute,
    differencePercent: comparison.differencePercent,
    result: comparison.result,
    targetDate,
    createdBy: req.user.id,
  });

  res.status(201).json({ item });
}

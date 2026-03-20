import mongoose from "mongoose";

export const IMPORT_ROW_STATUSES = ["parsed", "warning", "error", "pending", "suggested", "accepted", "edited", "ignored"];

const importRowSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "ImportSession", required: true },
    sheetRowNumber: { type: Number, required: true },
    rawJson: { type: mongoose.Schema.Types.Mixed, default: {} },
    rawConcept: { type: String, default: "" },
    rawUnit: { type: String, default: "" },
    rawQuantity: { type: String, default: "" },
    rawUnitPrice: { type: String, default: "" },
    rawAmount: { type: String, default: "" },
    rawSupplier: { type: String, default: "" },
    rawDate: { type: String, default: "" },
    rawCategory: { type: String, default: "" },
    normalizedConcept: { type: String, default: "" },
    parseStatus: { type: String, enum: IMPORT_ROW_STATUSES, default: "pending" },
    matchStatus: { type: String, enum: IMPORT_ROW_STATUSES, default: "pending" },
    confidenceScore: { type: Number, min: 0, max: 1, default: 0 },
  },
  { timestamps: true }
);

importRowSchema.index({ sessionId: 1, sheetRowNumber: 1 }, { unique: true });
importRowSchema.index({ parseStatus: 1, matchStatus: 1 });

export const ImportRow = mongoose.model("ImportRow", importRowSchema);

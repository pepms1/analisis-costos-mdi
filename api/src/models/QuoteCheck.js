import mongoose from "mongoose";
import { QUOTE_RESULTS } from "../utils/constants.js";

const quoteCheckSchema = new mongoose.Schema(
  {
    conceptId: { type: mongoose.Schema.Types.ObjectId, ref: "Concept", required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    referencePriceRecordId: { type: mongoose.Schema.Types.ObjectId, ref: "PriceRecord", required: true },
    historicalPrice: { type: Number, required: true },
    adjustedPrice: { type: Number, required: true },
    quotedPrice: { type: Number, required: true },
    differenceAbsolute: { type: Number, required: true },
    differencePercent: { type: Number, required: true },
    result: { type: String, enum: QUOTE_RESULTS, required: true },
    targetDate: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const QuoteCheck = mongoose.model("QuoteCheck", quoteCheckSchema);

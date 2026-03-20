import mongoose from "mongoose";
import { MAIN_TYPES } from "../utils/constants.js";

const priceRecordSchema = new mongoose.Schema(
  {
    mainType: { type: String, enum: MAIN_TYPES, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    conceptId: { type: mongoose.Schema.Types.ObjectId, ref: "Concept", required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    unit: { type: String, required: true },
    priceDate: { type: Date, required: true },
    pricingMode: { type: String, enum: ["unit_price", "total_price"], required: true },
    originalAmount: { type: Number, required: true },
    unitPrice: { type: Number, default: null },
    totalPrice: { type: Number, default: null },
    projectName: { type: String, default: "" },
    projectNameSnapshot: { type: String, default: "" },
    location: { type: String, default: "" },
    observations: { type: String, default: "" },
    dimensions: {
      width: Number,
      height: Number,
      length: Number,
      depth: Number,
      measurementUnit: { type: String, enum: ["cm", "m"], default: "cm" },
    },
    normalizedQuantity: { type: Number, default: null },
    normalizedUnit: { type: String, default: null },
    normalizedPrice: { type: Number, default: null },
    derivedValues: { type: mongoose.Schema.Types.Mixed, default: null },
    attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

priceRecordSchema.index({ projectId: 1 });
priceRecordSchema.index({ conceptId: 1 });
priceRecordSchema.index({ supplierId: 1 });
priceRecordSchema.index({ projectId: 1, conceptId: 1, priceDate: -1 });

export const PriceRecord = mongoose.model("PriceRecord", priceRecordSchema);

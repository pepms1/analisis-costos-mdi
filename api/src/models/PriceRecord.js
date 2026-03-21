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
    originalAmountCents: { type: Number, required: true },
    capturedAmount: { type: String, required: true },
    unitPrice: { type: Number, default: null },
    totalPrice: { type: Number, default: null },
    projectName: { type: String, default: "" },
    projectNameSnapshot: { type: String, default: "" },
    location: { type: String, default: "" },
    observations: { type: String, default: "" },
    dimensions: {
      largo: Number,
      ancho: Number,
      width: Number,
      height: Number,
      length: Number,
      depth: Number,
      measurementUnit: { type: String, enum: ["cm", "m"], default: "cm" },
    },
    normalizedQuantity: { type: Number, default: null },
    normalizedUnit: { type: String, default: null },
    normalizedPrice: { type: Number, default: null },
    geometryMeta: {
      lengthM: { type: Number, default: null },
      widthM: { type: Number, default: null },
      areaM2: { type: Number, default: null },
      sourceUnit: { type: String, default: null },
    },
    commercialUnit: { type: String, default: null },
    commercialUnitPrice: { type: Number, default: null },
    analysisUnit: { type: String, default: null },
    analysisUnitPrice: { type: Number, default: null },
    derivedValues: { type: mongoose.Schema.Types.Mixed, default: null },
    attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
    sourceImportSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "ImportSession", default: null },
    sourceImportRowId: { type: mongoose.Schema.Types.ObjectId, ref: "ImportRow", default: null },
    sourceFileName: { type: String, default: "" },
    captureOrigin: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

priceRecordSchema.index({ projectId: 1 });
priceRecordSchema.index({ conceptId: 1 });
priceRecordSchema.index({ supplierId: 1 });
priceRecordSchema.index({ projectId: 1, conceptId: 1, priceDate: -1 });
priceRecordSchema.index({ isDeleted: 1, priceDate: -1 });

export const PriceRecord = mongoose.model("PriceRecord", priceRecordSchema);

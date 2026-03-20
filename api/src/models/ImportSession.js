import mongoose from "mongoose";

export const IMPORT_SESSION_STATUSES = ["uploaded", "mapped", "parsed", "reviewing", "confirmed", "failed"];

const importSessionSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    fileType: { type: String, default: "application/vnd.ms-excel" },
    sourceType: { type: String, default: "excel" },
    sheetName: { type: String, default: "" },
    status: { type: String, enum: IMPORT_SESSION_STATUSES, default: "uploaded" },
    obraId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    defaultSupplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    defaultCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    defaultDate: { type: Date, default: null },
    columnMappingJson: { type: mongoose.Schema.Types.Mixed, default: {} },
    optionsJson: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

importSessionSchema.index({ createdBy: 1, createdAt: -1 });
importSessionSchema.index({ status: 1, createdAt: -1 });

export const ImportSession = mongoose.model("ImportSession", importSessionSchema);

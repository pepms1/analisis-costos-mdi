import mongoose from "mongoose";

const importRowDecisionSchema = new mongoose.Schema(
  {
    importRowId: { type: mongoose.Schema.Types.ObjectId, ref: "ImportRow", required: true, unique: true },
    decisionType: { type: String, enum: ["accepted", "edited", "ignored", "new"], required: true },
    finalCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    finalSupplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    finalCost: { type: Number, default: null },
    finalDate: { type: Date, default: null },
    finalWorkId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    finalNotes: { type: String, default: "" },
    savedHistoricId: { type: mongoose.Schema.Types.ObjectId, ref: "PriceRecord", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

importRowDecisionSchema.index({ createdBy: 1, createdAt: -1 });

export const ImportRowDecision = mongoose.model("ImportRowDecision", importRowDecisionSchema);

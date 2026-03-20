import mongoose from "mongoose";

const importRowSuggestionSchema = new mongoose.Schema(
  {
    importRowId: { type: mongoose.Schema.Types.ObjectId, ref: "ImportRow", required: true },
    suggestedCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    suggestedSupplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    suggestedCost: { type: Number, default: null },
    suggestedDate: { type: Date, default: null },
    suggestedHistoricId: { type: mongoose.Schema.Types.ObjectId, ref: "PriceRecord", default: null },
    suggestedWorkId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    score: { type: Number, min: 0, max: 1, default: 0 },
    reasonJson: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

importRowSuggestionSchema.index({ importRowId: 1, score: -1 });

export const ImportRowSuggestion = mongoose.model("ImportRowSuggestion", importRowSuggestionSchema);

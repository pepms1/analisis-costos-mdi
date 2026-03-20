import mongoose from "mongoose";
import { ADJUSTMENT_SCOPES, ADJUSTMENT_TYPES, MAIN_TYPES } from "../utils/constants.js";

const adjustmentSettingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    adjustmentType: { type: String, enum: ADJUSTMENT_TYPES, required: true },
    scopeType: { type: String, enum: ADJUSTMENT_SCOPES, required: true },
    mainType: { type: String, enum: MAIN_TYPES, default: null },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    factors: {
      type: [
        {
          label: { type: String, required: true },
          factor: { type: Number, required: true },
        },
      ],
      default: [],
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const AdjustmentSetting = mongoose.model("AdjustmentSetting", adjustmentSettingSchema);

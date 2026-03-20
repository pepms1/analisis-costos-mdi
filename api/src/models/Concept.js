import mongoose from "mongoose";
import { CALCULATION_TYPES, MAIN_TYPES } from "../utils/constants.js";

const conceptSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    mainType: { type: String, enum: MAIN_TYPES, required: true },
    primaryUnit: { type: String, required: true, trim: true },
    calculationType: { type: String, enum: CALCULATION_TYPES, default: "fixed_unit" },
    requiresDimensions: { type: Boolean, default: false },
    dimensionSchema: {
      width: { type: Boolean, default: false },
      height: { type: Boolean, default: false },
      length: { type: Boolean, default: false },
      depth: { type: Boolean, default: false },
      inputUnit: { type: String, enum: ["cm", "m"], default: "cm" },
    },
    technicalAttributesSchema: {
      type: [
        {
          key: { type: String, required: true },
          label: { type: String, required: true },
        },
      ],
      default: [],
    },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Concept = mongoose.model("Concept", conceptSchema);

import mongoose from "mongoose";
import { MAIN_TYPES } from "../utils/constants.js";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mainType: { type: String, enum: MAIN_TYPES, required: true },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Category = mongoose.model("Category", categorySchema);

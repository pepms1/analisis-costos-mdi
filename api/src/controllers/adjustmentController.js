import { AdjustmentSetting } from "../models/AdjustmentSetting.js";
import { AppError } from "../utils/AppError.js";

export async function listAdjustments(_req, res) {
  const items = await AdjustmentSetting.find().sort({ createdAt: -1 });
  res.json({ items });
}

export async function createAdjustment(req, res) {
  const item = await AdjustmentSetting.create({
    ...req.validatedBody,
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });

  res.status(201).json({ item });
}

export async function updateAdjustment(req, res) {
  const item = await AdjustmentSetting.findByIdAndUpdate(
    req.params.id,
    {
      ...req.validatedBody,
      updatedBy: req.user.id,
    },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("Adjustment not found", 404);
  }

  res.json({ item });
}

export async function deactivateAdjustment(req, res) {
  const item = await AdjustmentSetting.findByIdAndUpdate(
    req.params.id,
    {
      isActive: false,
      updatedBy: req.user.id,
    },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("Adjustment not found", 404);
  }

  res.json({ item });
}

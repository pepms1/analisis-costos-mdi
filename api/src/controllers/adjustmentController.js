import { AdjustmentSetting } from "../models/AdjustmentSetting.js";

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

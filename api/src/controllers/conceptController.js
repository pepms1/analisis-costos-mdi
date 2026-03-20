import { Category } from "../models/Category.js";
import { Concept } from "../models/Concept.js";
import { AppError } from "../utils/AppError.js";
import mongoose from "mongoose";

function ensureValidObjectId(value, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`${fieldName} must be a valid ObjectId`, 400);
  }
}

export async function listConcepts(_req, res) {
  const items = await Concept.find()
    .populate("categoryId", "name")
    .sort({ createdAt: -1 });

  res.json({
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      categoryId: item.categoryId?._id?.toString() || null,
      categoryName: item.categoryId?.name || "—",
      mainType: item.mainType,
      primaryUnit: item.primaryUnit,
      calculationType: item.calculationType,
      requiresDimensions: item.requiresDimensions,
      description: item.description,
      isActive: item.isActive,
    })),
  });
}

export async function createConcept(req, res) {
  ensureValidObjectId(req.validatedBody.categoryId, "categoryId");

  const category = await Category.findById(req.validatedBody.categoryId);

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  if (category.mainType !== req.validatedBody.mainType) {
    throw new AppError("Category mainType must match concept mainType", 400);
  }

  const item = await Concept.create({
    ...req.validatedBody,
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });

  res.status(201).json({ item });
}

export async function updateConcept(req, res) {
  ensureValidObjectId(req.params.id, "conceptId");
  ensureValidObjectId(req.validatedBody.categoryId, "categoryId");

  const category = await Category.findById(req.validatedBody.categoryId);

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  if (category.mainType !== req.validatedBody.mainType) {
    throw new AppError("Category mainType must match concept mainType", 400);
  }

  const item = await Concept.findByIdAndUpdate(
    req.params.id,
    {
      ...req.validatedBody,
      updatedBy: req.user.id,
    },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("Concept not found", 404);
  }

  res.json({ item });
}


export async function deactivateConcept(req, res) {
  ensureValidObjectId(req.params.id, "conceptId");

  const item = await Concept.findByIdAndUpdate(
    req.params.id,
    {
      isActive: false,
      updatedBy: req.user.id,
    },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("Concept not found", 404);
  }

  res.json({ item });
}

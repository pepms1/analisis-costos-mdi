import { Category } from "../models/Category.js";
import { AppError } from "../utils/AppError.js";

export async function listCategories(_req, res) {
  const items = await Category.find().sort({ createdAt: -1 });
  res.json({
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      mainType: item.mainType,
      description: item.description,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  });
}

export async function createCategory(req, res) {
  const item = await Category.create({
    ...req.validatedBody,
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });

  res.status(201).json({ item });
}

export async function updateCategory(req, res) {
  const item = await Category.findByIdAndUpdate(
    req.params.id,
    {
      ...req.validatedBody,
      updatedBy: req.user.id,
    },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("Category not found", 404);
  }

  res.json({ item });
}

export async function deactivateCategory(req, res) {
  const item = await Category.findByIdAndUpdate(
    req.params.id,
    {
      isActive: false,
      updatedBy: req.user.id,
    },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("Category not found", 404);
  }

  res.json({ item });
}

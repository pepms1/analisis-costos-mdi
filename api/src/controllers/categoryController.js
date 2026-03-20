import { Category } from "../models/Category.js";

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

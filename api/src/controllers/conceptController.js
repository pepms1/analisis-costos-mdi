import { Category } from "../models/Category.js";
import { Concept } from "../models/Concept.js";
import { AppError } from "../utils/AppError.js";
import mongoose from "mongoose";

function ensureValidObjectId(value, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`${fieldName} must be a valid ObjectId`, 400);
  }
}

function normalizeConceptName(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function sanitizeConceptName(value = "") {
  return value.trim().replace(/\s+/g, " ");
}

async function ensureUniqueConceptName({ categoryId, name, excludingId = null }) {
  const duplicate = await Concept.findOne({
    categoryId,
    normalizedName: normalizeConceptName(name),
    ...(excludingId ? { _id: { $ne: excludingId } } : {}),
  }).select("name");

  if (duplicate) {
    throw new AppError("Ya existe un concepto con ese nombre dentro de esta categoría.", 409);
  }
}

export async function listConcepts(req, res) {
  const status = req.query.status || "active";
  const query = {};
  if (status === "active") query.isActive = true;
  if (status === "inactive") query.isActive = false;
  const items = await Concept.find(query)
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
      dimensionSchema: item.dimensionSchema || null,
      description: item.description,
      isActive: item.isActive,
    })),
  });
}

export async function createConcept(req, res) {
  ensureValidObjectId(req.validatedBody.categoryId, "categoryId");

  const sanitizedName = sanitizeConceptName(req.validatedBody.name);

  const category = await Category.findById(req.validatedBody.categoryId);

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  if (category.mainType !== req.validatedBody.mainType) {
    throw new AppError("Category mainType must match concept mainType", 400);
  }

  await ensureUniqueConceptName({
    categoryId: req.validatedBody.categoryId,
    name: sanitizedName,
  });

  const item = await Concept.create({
    ...req.validatedBody,
    name: sanitizedName,
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });

  res.status(201).json({ item });
}

export async function updateConcept(req, res) {
  ensureValidObjectId(req.params.id, "conceptId");
  ensureValidObjectId(req.validatedBody.categoryId, "categoryId");

  const sanitizedName = sanitizeConceptName(req.validatedBody.name);

  const category = await Category.findById(req.validatedBody.categoryId);

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  if (category.mainType !== req.validatedBody.mainType) {
    throw new AppError("Category mainType must match concept mainType", 400);
  }

  await ensureUniqueConceptName({
    categoryId: req.validatedBody.categoryId,
    name: sanitizedName,
    excludingId: req.params.id,
  });

  const item = await Concept.findByIdAndUpdate(
    req.params.id,
    {
      ...req.validatedBody,
      name: sanitizedName,
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

export async function reactivateConcept(req, res) {
  ensureValidObjectId(req.params.id, "conceptId");

  const item = await Concept.findByIdAndUpdate(
    req.params.id,
    {
      isActive: true,
      updatedBy: req.user.id,
    },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("Concept not found", 404);
  }

  res.json({ item });
}

import { Category } from "../models/Category.js";
import { Concept } from "../models/Concept.js";
import { PriceRecord } from "../models/PriceRecord.js";
import { Project } from "../models/Project.js";
import { Supplier } from "../models/Supplier.js";
import { AppError } from "../utils/AppError.js";
import { buildPricingPayload } from "../utils/normalization.js";

export async function listPriceRecords(req, res) {
  const query = {};
  const shouldPopulate = req.query.populate !== "0";

  if (req.query.conceptId) query.conceptId = req.query.conceptId;
  if (req.query.categoryId) query.categoryId = req.query.categoryId;
  if (req.query.supplierId) query.supplierId = req.query.supplierId;
  if (req.query.projectId) query.projectId = req.query.projectId;
  if (req.query.mainType) query.mainType = req.query.mainType;
  if (req.query.dateFrom || req.query.dateTo) {
    query.priceDate = {};
    if (req.query.dateFrom) query.priceDate.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) query.priceDate.$lte = new Date(req.query.dateTo);
  }

  let recordsQuery = PriceRecord.find(query).sort({ priceDate: -1, createdAt: -1 });

  if (shouldPopulate) {
    recordsQuery = recordsQuery
      .populate("conceptId", "name")
      .populate("supplierId", "name")
      .populate("projectId", "name code");
  }

  const items = await recordsQuery;

  res.json({
    items: items.map((item) => ({
      id: item.id,
      priceDate: item.priceDate,
      conceptId: typeof item.conceptId === "object" ? item.conceptId?._id?.toString() : item.conceptId?.toString(),
      supplierId:
        typeof item.supplierId === "object" ? item.supplierId?._id?.toString() : item.supplierId?.toString(),
      projectId: typeof item.projectId === "object" ? item.projectId?._id?.toString() : item.projectId?.toString(),
      conceptName: item.conceptId?.name || "—",
      supplierName: item.supplierId?.name || "—",
      projectName: item.projectId?.name || item.projectNameSnapshot || item.projectName || "—",
      mainType: item.mainType,
      amount: item.originalAmount,
      normalizedPrice: item.normalizedPrice,
      normalizedUnit: item.normalizedUnit,
      location: item.location,
      observations: item.observations,
    })),
  });
}

export async function createPriceRecord(req, res) {
  const {
    categoryId,
    conceptId,
    supplierId,
    projectId,
    mainType,
    dimensions,
    pricingMode,
    amount,
    attributes,
    ...rest
  } = req.validatedBody;

  const [category, concept, supplier, project] = await Promise.all([
    Category.findById(categoryId),
    Concept.findById(conceptId),
    supplierId ? Supplier.findById(supplierId) : Promise.resolve(null),
    projectId ? Project.findById(projectId) : Promise.resolve(null),
  ]);

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  if (!concept) {
    throw new AppError("Concept not found", 404);
  }

  if (supplierId && !supplier) {
    throw new AppError("Supplier not found", 404);
  }

  if (projectId && !project) {
    throw new AppError("Project not found", 404);
  }

  if (project && !project.isActive) {
    throw new AppError("Inactive projects cannot be used in new price records", 400);
  }

  if (category.mainType !== mainType || concept.mainType !== mainType) {
    throw new AppError("mainType must match category and concept", 400);
  }

  const pricingPayload = buildPricingPayload({
    calculationType: concept.calculationType,
    dimensions,
    pricingMode,
    amount,
  });

  const item = await PriceRecord.create({
    ...rest,
    mainType,
    categoryId,
    conceptId,
    supplierId: supplierId || null,
    projectId: projectId || null,
    projectNameSnapshot: project?.name || "",
    dimensions,
    pricingMode,
    attributes: attributes || {},
    ...pricingPayload,
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });

  res.status(201).json({ item });
}

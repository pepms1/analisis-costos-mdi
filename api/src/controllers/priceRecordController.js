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
      categoryId: item.categoryId?.toString(),
      conceptName: item.conceptId?.name || "—",
      supplierName: item.supplierId?.name || "—",
      projectName: item.projectId?.name || item.projectNameSnapshot || item.projectName || "—",
      mainType: item.mainType,
      unit: item.unit,
      pricingMode: item.pricingMode,
      amount: item.originalAmount,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      normalizedPrice: item.normalizedPrice,
      normalizedQuantity: item.normalizedQuantity,
      normalizedUnit: item.normalizedUnit,
      derivedValues: item.derivedValues,
      location: item.location,
      observations: item.observations,
      dimensions: item.dimensions,
    })),
  });
}

async function resolveDependencies({ categoryId, conceptId, supplierId, projectId }) {
  const [category, concept, supplier, project] = await Promise.all([
    Category.findById(categoryId),
    Concept.findById(conceptId),
    supplierId ? Supplier.findById(supplierId) : Promise.resolve(null),
    projectId ? Project.findById(projectId) : Promise.resolve(null),
  ]);

  if (!category) throw new AppError("Category not found", 404);
  if (!concept) throw new AppError("Concept not found", 404);
  if (supplierId && !supplier) throw new AppError("Supplier not found", 404);
  if (projectId && !project) throw new AppError("Project not found", 404);

  return { category, concept, project };
}

function validatePricingConsistency({ category, concept, project, mainType }) {
  if (project && !project.isActive) {
    throw new AppError("Inactive projects cannot be used in price records", 400);
  }

  if (category.mainType !== mainType || concept.mainType !== mainType) {
    throw new AppError("mainType must match category and concept", 400);
  }
}

function resolvePricingMode(mainType, pricingMode) {
  if (mainType === "labor") return "total_price";
  return pricingMode || "unit_price";
}

function buildRecordPayload(validatedBody, reqUserId, concept, project) {
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
  } = validatedBody;

  const pricingPayload = buildPricingPayload({
    calculationType: concept.calculationType,
    dimensions,
    pricingMode: resolvePricingMode(mainType, pricingMode),
    amount,
    requiresDimensions: concept.requiresDimensions,
  });

  return {
    ...rest,
    mainType,
    categoryId,
    conceptId,
    supplierId: supplierId || null,
    projectId: projectId || null,
    projectNameSnapshot: project?.name || "",
    dimensions,
    pricingMode: resolvePricingMode(mainType, pricingMode),
    attributes: attributes || {},
    ...pricingPayload,
    updatedBy: reqUserId,
  };
}

export async function createPriceRecord(req, res) {
  const { category, concept, project } = await resolveDependencies(req.validatedBody);
  validatePricingConsistency({ category, concept, project, mainType: req.validatedBody.mainType });

  const item = await PriceRecord.create({
    ...buildRecordPayload(req.validatedBody, req.user.id, concept, project),
    createdBy: req.user.id,
  });

  res.status(201).json({ item });
}

export async function updatePriceRecord(req, res) {
  const { category, concept, project } = await resolveDependencies(req.validatedBody);
  validatePricingConsistency({ category, concept, project, mainType: req.validatedBody.mainType });

  const item = await PriceRecord.findByIdAndUpdate(
    req.params.id,
    buildRecordPayload(req.validatedBody, req.user.id, concept, project),
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("Price record not found", 404);
  }

  res.json({ item });
}

export async function deletePriceRecord(req, res) {
  const item = await PriceRecord.findByIdAndDelete(req.params.id);

  if (!item) {
    throw new AppError("Price record not found", 404);
  }

  res.status(204).send();
}

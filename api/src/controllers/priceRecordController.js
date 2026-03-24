import { Category } from "../models/Category.js";
import { Concept } from "../models/Concept.js";
import { ImportRowDecision } from "../models/ImportRowDecision.js";
import { PriceRecord } from "../models/PriceRecord.js";
import { Project } from "../models/Project.js";
import { Supplier } from "../models/Supplier.js";
import mongoose from "mongoose";
import { AppError } from "../utils/AppError.js";
import { centsToAmount, parseMoneyInput } from "../utils/money.js";
import { buildPricingPayload, normalizeDimensions, toMeters } from "../utils/normalization.js";
import { parseDateOnly, toDateOnlyString } from "../utils/dateOnly.js";

function parsePositiveInt(value) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function normalizeProjectIdsInput(projectIds, projectId) {
  const normalized = [];
  const pushIfValid = (value) => {
    if (!value) return;
    const normalizedId = String(value).trim();
    if (normalizedId) normalized.push(normalizedId);
  };

  if (Array.isArray(projectIds)) {
    projectIds.forEach((value) => pushIfValid(value));
  }

  const cleaned = normalized.filter((value) => value !== "null" && value !== "undefined");
  const normalizedLegacyProjectId = projectId ? String(projectId).trim() : "";
  if (
    normalizedLegacyProjectId &&
    normalizedLegacyProjectId !== "null" &&
    normalizedLegacyProjectId !== "undefined" &&
    !cleaned.includes(normalizedLegacyProjectId)
  ) {
    cleaned.push(normalizedLegacyProjectId);
  }

  return cleaned;
}

function assertUniqueProjectIds(projectIds = []) {
  const unique = new Set(projectIds);
  if (unique.size !== projectIds.length) {
    throw new AppError("projectIds cannot contain duplicated values", 400);
  }
}

function toUniqueProjectIds(projectIds = []) {
  return [...new Set(projectIds)];
}

function assertValidProjectIds(projectIds = []) {
  const invalidValue = projectIds.find((value) => !mongoose.Types.ObjectId.isValid(value));
  if (invalidValue) {
    throw new AppError("Invalid projectId provided", 400);
  }
}

function getRecordProjectIds(item) {
  const projectIdsFromArray = Array.isArray(item.projectIds) ? item.projectIds : [];
  const normalizedFromArray = projectIdsFromArray
    .map((project) => (typeof project === "object" ? project?._id?.toString() : project?.toString()))
    .filter(Boolean);
  const legacyProjectId = typeof item.projectId === "object" ? item.projectId?._id?.toString() : item.projectId?.toString();
  const all = [...normalizedFromArray, legacyProjectId].filter(Boolean);
  return [...new Set(all)];
}

function getRecordProjectNames(item) {
  const projectNamesFromArray = (Array.isArray(item.projectIds) ? item.projectIds : [])
    .map((project) => (typeof project === "object" ? project?.name : null))
    .filter(Boolean);
  const legacyName = item.projectId?.name || null;
  const names = [...projectNamesFromArray, legacyName].filter(Boolean);
  const unique = [...new Set(names)];
  if (unique.length > 0) return unique;

  if (item.projectNameSnapshot) {
    return item.projectNameSnapshot
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
  }
  if (item.projectName) return [item.projectName];
  return [];
}

async function resolveSearchFilters(search) {
  const normalizedSearch = search?.trim();
  if (!normalizedSearch) return null;

  const regex = new RegExp(normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const [matchingConcepts, matchingSuppliers, matchingCategories] = await Promise.all([
    Concept.find({ name: regex }).select("_id").lean(),
    Supplier.find({ name: regex }).select("_id").lean(),
    Category.find({ name: regex }).select("_id").lean(),
  ]);

  return {
    $or: [
      { observations: regex },
      { location: regex },
      { capturedAmount: regex },
      ...(matchingConcepts.length ? [{ conceptId: { $in: matchingConcepts.map((item) => item._id) } }] : []),
      ...(matchingSuppliers.length ? [{ supplierId: { $in: matchingSuppliers.map((item) => item._id) } }] : []),
      ...(matchingCategories.length ? [{ categoryId: { $in: matchingCategories.map((item) => item._id) } }] : []),
    ],
  };
}

export async function listPriceRecords(req, res) {
  const query = { isDeleted: { $ne: true } };
  const shouldPopulate = req.query.populate !== "0";

  if (req.query.conceptId) query.conceptId = req.query.conceptId;
  if (req.query.categoryId) query.categoryId = req.query.categoryId;
  if (req.query.supplierId) query.supplierId = req.query.supplierId;
  if (req.query.projectId) {
    if (!mongoose.Types.ObjectId.isValid(req.query.projectId)) {
      throw new AppError("Invalid projectId provided", 400);
    }
    query.$and = [
      ...(query.$and || []),
      { $or: [{ projectId: req.query.projectId }, { projectIds: req.query.projectId }] },
    ];
  }
  if (req.query.mainType) query.mainType = req.query.mainType;
  if (req.query.dateFrom || req.query.dateTo) {
    query.priceDate = {};
    if (req.query.dateFrom) query.priceDate.$gte = parseDateOnly(req.query.dateFrom, { fieldName: "dateFrom" });
    if (req.query.dateTo) query.priceDate.$lte = parseDateOnly(req.query.dateTo, { fieldName: "dateTo", endOfDay: true });
  }

  const searchFilter = await resolveSearchFilters(req.query.search);
  if (searchFilter) {
    query.$and = [...(query.$and || []), searchFilter];
  }

  const sortDirection = req.query.sort === "asc" ? 1 : -1;
  const page = parsePositiveInt(req.query.page);
  const requestedLimit = parsePositiveInt(req.query.limit);
  const hasPagination = Boolean(page || requestedLimit);
  const limit = Math.min(requestedLimit || 25, 200);
  const effectivePage = page || 1;

  let recordsQuery = PriceRecord.find(query).sort({ priceDate: sortDirection, createdAt: sortDirection });

  if (hasPagination) {
    recordsQuery = recordsQuery.skip((effectivePage - 1) * limit).limit(limit);
  }

  if (shouldPopulate) {
    recordsQuery = recordsQuery
      .populate("categoryId", "name")
      .populate("conceptId", "name")
      .populate("supplierId", "name")
      .populate("projectId", "name code")
      .populate("projectIds", "name code")
      .populate("createdBy", "name email");
  }

  const [items, totalItems] = await Promise.all([
    recordsQuery,
    hasPagination ? PriceRecord.countDocuments(query) : Promise.resolve(null),
  ]);

  res.json({
    items: items.map((item) => serializePriceRecord(item)),
    ...(hasPagination
      ? {
          pagination: {
            page: effectivePage,
            limit,
            totalItems,
            totalPages: Math.max(1, Math.ceil(totalItems / limit)),
          },
        }
      : {}),
  });
}

function serializePriceRecord(item) {
  const projectIds = getRecordProjectIds(item);
  const projectNames = getRecordProjectNames(item);

  return {
    id: item.id,
    priceDate: toDateOnlyString(item.priceDate),
    conceptId: typeof item.conceptId === "object" ? item.conceptId?._id?.toString() : item.conceptId?.toString(),
    supplierId:
      typeof item.supplierId === "object" ? item.supplierId?._id?.toString() : item.supplierId?.toString(),
    projectId: projectIds[0] || null,
    projectIds,
    categoryId: typeof item.categoryId === "object" ? item.categoryId?._id?.toString() : item.categoryId?.toString(),
    conceptName: item.conceptId?.name || "—",
    categoryName: item.categoryId?.name || "—",
    supplierName: item.supplierId?.name || "—",
    projectName: projectNames[0] || "—",
    projectNames,
    mainType: item.mainType,
    unit: item.unit,
    pricingMode: item.pricingMode,
    amount: Number.isSafeInteger(item.originalAmountCents) ? centsToAmount(item.originalAmountCents) : item.originalAmount,
    capturedAmount: item.capturedAmount || null,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    normalizedPrice: item.normalizedPrice,
    normalizedQuantity: item.normalizedQuantity,
    normalizedUnit: item.normalizedUnit,
    geometryMeta: item.geometryMeta || null,
    commercialUnit: item.commercialUnit || null,
    commercialUnitPrice: item.commercialUnitPrice ?? null,
    analysisUnit: item.analysisUnit || null,
    analysisUnitPrice: item.analysisUnitPrice ?? null,
    derivedValues: item.derivedValues,
    captureOrigin: item.captureOrigin || "manual",
    sourceFileName: item.sourceFileName || "",
    sourceImportSessionId: item.sourceImportSessionId || null,
    attributes: item.attributes || {},
    location: item.location,
    observations: item.observations,
    dimensions: item.dimensions,
    createdByName: item.createdBy?.name || "—",
    createdByEmail: item.createdBy?.email || "",
    createdAt: item.createdAt,
  };
}

async function resolveDependencies({ categoryId, conceptId, supplierId, projectId, projectIds }) {
  const normalizedProjectIdsInput = normalizeProjectIdsInput(projectIds, projectId);
  assertUniqueProjectIds(normalizedProjectIdsInput);
  assertValidProjectIds(normalizedProjectIdsInput);
  const normalizedProjectIds = toUniqueProjectIds(normalizedProjectIdsInput);

  const [category, concept, supplier, projects] = await Promise.all([
    Category.findById(categoryId),
    Concept.findById(conceptId),
    supplierId ? Supplier.findById(supplierId) : Promise.resolve(null),
    normalizedProjectIds.length
      ? Project.find({ _id: { $in: normalizedProjectIds } })
      : Promise.resolve([]),
  ]);

  if (!category) throw new AppError("Category not found", 404);
  if (!concept) throw new AppError("Concept not found", 404);
  if (supplierId && !supplier) throw new AppError("Supplier not found", 404);
  if (normalizedProjectIds.length !== projects.length) throw new AppError("Project not found", 404);

  return { category, concept, projects, normalizedProjectIds };
}

function validatePricingConsistency({ category, concept, projects, mainType }) {
  if (projects.some((project) => !project.isActive)) {
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

function buildGeometryMeta(dimensions = {}) {
  if (!dimensions) return null;
  const sourceUnit = dimensions.measurementUnit || "cm";
  const largoRaw = dimensions.largo ?? dimensions.length ?? dimensions.width ?? null;
  const anchoRaw = dimensions.ancho ?? dimensions.height ?? null;
  const lengthM = toMeters(largoRaw, sourceUnit);
  const widthM = toMeters(anchoRaw, sourceUnit);
  const areaM2 = lengthM && widthM ? lengthM * widthM : null;
  if (!lengthM || !widthM || !areaM2) return null;
  return {
    lengthM,
    widthM,
    areaM2,
    sourceUnit,
  };
}

function buildRecordPayload(validatedBody, reqUserId, concept, projects) {
  const {
    categoryId,
    conceptId,
    supplierId,
    projectId,
    projectIds,
    mainType,
    unit,
    dimensions,
    pricingMode,
    amount,
    attributes,
    commercialUnit,
    commercialUnitPrice,
    analysisUnit,
    analysisUnitPrice,
    geometryMeta,
    ...rest
  } = validatedBody;

  const { cents: originalAmountCents, normalizedAmount, normalizedString } = parseMoneyInput(amount);
  const resolvedUnit = (unit || concept.primaryUnit || "").trim();
  if (!resolvedUnit) {
    throw new AppError("La unidad es obligatoria para guardar el precio.", 400);
  }

  const pricingPayload = buildPricingPayload({
    calculationType: concept.calculationType,
    dimensions,
    pricingMode: resolvePricingMode(mainType, pricingMode),
    amount: normalizedAmount,
    requiresDimensions: concept.requiresDimensions,
  });

  const normalizedDimensions = normalizeDimensions(concept.calculationType, dimensions, concept.requiresDimensions);
  const computedGeometryMeta = geometryMeta || buildGeometryMeta(dimensions);
  const analysisUnitNormalized = (analysisUnit || "").trim().toLowerCase() || null;
  const effectiveArea =
    computedGeometryMeta?.areaM2 || normalizedDimensions?.normalizedQuantity || pricingPayload.normalizedQuantity || null;
  const computedAnalysisUnitPrice =
    analysisUnitNormalized === "m2" && effectiveArea && pricingPayload.totalPrice
      ? Number((pricingPayload.totalPrice / effectiveArea).toFixed(6))
      : null;

  const normalizedProjectIds = normalizeProjectIdsInput(projectIds, projectId);
  assertUniqueProjectIds(normalizedProjectIds);
  const uniqueProjectIds = toUniqueProjectIds(normalizedProjectIds);
  const activeProjects = projects.filter((project) => uniqueProjectIds.includes(project.id));

  return {
    ...rest,
    priceDate: parseDateOnly(rest.priceDate, { fieldName: "priceDate" }),
    mainType,
    categoryId,
    conceptId,
    supplierId: supplierId || null,
    projectId: uniqueProjectIds[0] || null,
    projectIds: uniqueProjectIds,
    projectNameSnapshot: activeProjects.map((project) => project.name).join(", "),
    unit: resolvedUnit,
    dimensions,
    pricingMode: resolvePricingMode(mainType, pricingMode),
    attributes: attributes || {},
    geometryMeta: computedGeometryMeta,
    commercialUnit: commercialUnit || resolvedUnit || null,
    commercialUnitPrice: commercialUnitPrice ?? pricingPayload.totalPrice ?? null,
    analysisUnit: analysisUnitNormalized,
    analysisUnitPrice: analysisUnitPrice ?? computedAnalysisUnitPrice,
    originalAmount: normalizedAmount,
    originalAmountCents,
    capturedAmount: normalizedString,
    ...pricingPayload,
    updatedBy: reqUserId,
  };
}

export async function createPriceRecord(req, res) {
  const { category, concept, projects } = await resolveDependencies(req.validatedBody);
  validatePricingConsistency({ category, concept, projects, mainType: req.validatedBody.mainType });

  const item = await PriceRecord.create({
    ...buildRecordPayload(req.validatedBody, req.user.id, concept, projects),
    createdBy: req.user.id,
  });

  const populatedItem = await PriceRecord.findById(item._id)
    .populate("categoryId", "name")
    .populate("conceptId", "name")
    .populate("supplierId", "name")
    .populate("projectId", "name code")
    .populate("projectIds", "name code")
    .populate("createdBy", "name email");

  res.status(201).json({ item: serializePriceRecord(populatedItem) });
}

export async function updatePriceRecord(req, res) {
  const { category, concept, projects } = await resolveDependencies(req.validatedBody);
  validatePricingConsistency({ category, concept, projects, mainType: req.validatedBody.mainType });

  const item = await PriceRecord.findByIdAndUpdate(
    req.params.id,
    buildRecordPayload(req.validatedBody, req.user.id, concept, projects),
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("Price record not found", 404);
  }

  const populatedItem = await PriceRecord.findById(item._id)
    .populate("categoryId", "name")
    .populate("conceptId", "name")
    .populate("supplierId", "name")
    .populate("projectId", "name code")
    .populate("projectIds", "name code")
    .populate("createdBy", "name email");

  res.json({ item: serializePriceRecord(populatedItem) });
}

export async function deletePriceRecord(req, res) {
  if (req.user?.role !== "superadmin") {
    throw new AppError("Only superadmin can delete historical records", 403);
  }

  const item = await PriceRecord.findOneAndUpdate(
    { _id: req.params.id, isDeleted: { $ne: true } },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user.id,
        updatedBy: req.user.id,
      },
    },
    { new: true }
  );

  if (!item) {
    throw new AppError("Price record not found", 404);
  }

  const hasImportTraceability =
    item.captureOrigin === "excel_import" && item.sourceImportSessionId && item.sourceImportRowId;
  if (hasImportTraceability) {
    await ImportRowDecision.updateOne(
      {
        importRowId: item.sourceImportRowId,
        savedHistoricId: item._id,
      },
      {
        $set: {
          savedHistoricId: null,
        },
      }
    );
  }

  res.status(204).send();
}

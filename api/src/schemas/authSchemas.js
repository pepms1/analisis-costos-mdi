import { z } from "zod";
import { USER_ROLES, MAIN_TYPES, CALCULATION_TYPES, ADJUSTMENT_SCOPES, ADJUSTMENT_TYPES } from "../utils/constants.js";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(USER_ROLES),
});

export const updateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
  password: z.string().min(8).optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(2),
  mainType: z.enum(MAIN_TYPES),
  description: z.string().optional().default(""),
});

export const createConceptSchema = z.object({
  name: z.string().min(2),
  categoryId: z.string().min(1),
  mainType: z.enum(MAIN_TYPES),
  primaryUnit: z.string().min(1),
  calculationType: z.enum(CALCULATION_TYPES),
  requiresDimensions: z.boolean().default(false),
  dimensionSchema: z
    .object({
      width: z.boolean().optional(),
      height: z.boolean().optional(),
      length: z.boolean().optional(),
      depth: z.boolean().optional(),
      inputUnit: z.enum(["cm", "m"]).optional(),
    })
    .nullable()
    .optional(),
  technicalAttributesSchema: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
  description: z.string().optional().default(""),
});

export const updateConceptSchema = createConceptSchema;

export const updateCategorySchema = createCategorySchema;

export const createSupplierSchema = z.object({
  name: z.string().min(2),
  legalName: z.string().optional().default(""),
  contactName: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export const updateSupplierSchema = createSupplierSchema;

export const createProjectSchema = z.object({
  name: z.string().min(2),
  code: z.string().optional().default(""),
  clientName: z.string().optional().default(""),
  location: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  isActive: z.boolean().optional().default(true),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2),
  code: z.string().optional().default(""),
  clientName: z.string().optional().default(""),
  location: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  isActive: z.boolean(),
});

export const createPriceRecordSchema = z.object({
  mainType: z.enum(MAIN_TYPES),
  categoryId: z.string().min(1),
  conceptId: z.string().min(1),
  supplierId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  unit: z.string().min(1),
  priceDate: z.string().min(1),
  pricingMode: z.enum(["unit_price", "total_price"]).optional(),
  amount: z.union([z.number().positive(), z.string().min(1)]),
  location: z.string().optional().default(""),
  observations: z.string().optional().default(""),
  dimensions: z
    .object({
      largo: z.number().positive().optional(),
      ancho: z.number().positive().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      length: z.number().positive().optional(),
      depth: z.number().positive().optional(),
      measurementUnit: z.enum(["cm", "m"]).optional(),
    })
    .optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});

export const updatePriceRecordSchema = createPriceRecordSchema;

export const createAdjustmentSchema = z.object({
  name: z.string().min(2),
  adjustmentType: z.enum(ADJUSTMENT_TYPES),
  scopeType: z.enum(ADJUSTMENT_SCOPES),
  mainType: z.enum(MAIN_TYPES).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  factors: z.array(
    z.object({
      label: z.string().min(1),
      factor: z.number().positive(),
    })
  ),
});

export const updateAdjustmentSchema = createAdjustmentSchema;

export const createQuoteCheckSchema = z.object({
  conceptId: z.string().min(1),
  supplierId: z.string().nullable().optional(),
  quotedPrice: z.number().positive(),
  targetDate: z.string().min(1),
  dimensions: z
    .object({
      largo: z.number().positive().optional(),
      ancho: z.number().positive().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      length: z.number().positive().optional(),
      measurementUnit: z.enum(["cm", "m"]).optional(),
    })
    .optional(),
});


export const createImportSessionSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().optional().default("application/vnd.ms-excel"),
  sourceType: z.string().optional().default("excel"),
  sheetName: z.string().optional().default(""),
  status: z.enum(["uploaded", "mapped", "parsed", "reviewing", "confirmed", "failed"]).optional(),
  obraId: z.string().nullable().optional(),
  defaultSupplierId: z.string().nullable().optional(),
  defaultCategoryId: z.string().nullable().optional(),
  defaultDate: z.string().nullable().optional(),
  columnMappingJson: z.record(z.string(), z.any()).optional().default({}),
  optionsJson: z.record(z.string(), z.any()).optional().default({}),
});


export const uploadImportSessionFileSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().optional().default("application/octet-stream"),
  fileBase64: z.string().min(1),
});

export const saveImportSessionMappingSchema = z.object({
  sheetName: z.string().min(1),
  headerRowIndex: z.number().int().min(1),
  dataStartRowIndex: z.number().int().min(1),
  ignoreEmptyRows: z.boolean().optional().default(true),
  columnMappingJson: z.record(z.string(), z.string().nullable()).default({}),
  detectedSupplierId: z.string().nullable().optional(),
  detectedWorkId: z.string().nullable().optional(),
  detectedYear: z.number().int().min(1900).max(2100).nullable().optional(),
  detectedDate: z.string().nullable().optional(),
  detectedContextJson: z.record(z.string(), z.any()).nullable().optional(),
  optionsJson: z.record(z.string(), z.any()).optional().default({}),
});

export const saveImportRowDecisionSchema = z.object({
  decisionType: z.enum(["accepted", "edited", "ignored", "new"]),
  finalCategoryId: z.string().nullable().optional(),
  finalSupplierId: z.string().nullable().optional(),
  finalCost: z.number().nullable().optional(),
  finalDate: z.string().nullable().optional(),
  finalWorkId: z.string().nullable().optional(),
  finalNotes: z.string().optional().default(""),
  finalMeasurementsJson: z
    .object({
      lengthM: z.number().positive().nullable().optional(),
      widthM: z.number().positive().nullable().optional(),
      sourceUnit: z.enum(["mm", "cm", "m"]).nullable().optional(),
      areaM2: z.number().nonnegative().nullable().optional(),
      applicationUnit: z.string().nullable().optional(),
      commercialUnit: z.string().nullable().optional(),
      commercialUnitPrice: z.number().nonnegative().nullable().optional(),
      analysisUnit: z.string().nullable().optional(),
      analysisUnitPrice: z.number().nonnegative().nullable().optional(),
      rawPattern: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .nullable()
    .optional(),
  savedHistoricId: z.string().nullable().optional(),
});

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

export const createSupplierSchema = z.object({
  name: z.string().min(2),
  legalName: z.string().optional().default(""),
  contactName: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

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
  pricingMode: z.enum(["unit_price", "total_price"]),
  amount: z.number().positive(),
  location: z.string().optional().default(""),
  observations: z.string().optional().default(""),
  dimensions: z
    .object({
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      length: z.number().positive().optional(),
      depth: z.number().positive().optional(),
      measurementUnit: z.enum(["cm", "m"]).optional(),
    })
    .optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});

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

export const createQuoteCheckSchema = z.object({
  conceptId: z.string().min(1),
  supplierId: z.string().nullable().optional(),
  quotedPrice: z.number().positive(),
  targetDate: z.string().min(1),
});

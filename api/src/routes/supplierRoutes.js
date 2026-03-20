import { Router } from "express";
import {
  createSupplier,
  deactivateSupplier,
  listSuppliers,
  reactivateSupplier,
  updateSupplier,
} from "../controllers/supplierController.js";
import { requirePermission } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createSupplierSchema, updateSupplierSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.get("/", requirePermission(PERMISSIONS.CATALOGS_VIEW), asyncHandler(listSuppliers));
router.post("/", requirePermission(PERMISSIONS.CATALOGS_MANAGE), validate(createSupplierSchema), asyncHandler(createSupplier));
router.put("/:id", requirePermission(PERMISSIONS.CATALOGS_MANAGE), validate(updateSupplierSchema), asyncHandler(updateSupplier));
router.delete("/:id", requirePermission(PERMISSIONS.CATALOGS_MANAGE), asyncHandler(deactivateSupplier));
router.patch("/:id/reactivate", requirePermission(PERMISSIONS.CATALOGS_MANAGE), asyncHandler(reactivateSupplier));

export default router;

import { Router } from "express";
import {
  createSupplier,
  deactivateSupplier,
  listSuppliers,
  reactivateSupplier,
  updateSupplier,
} from "../controllers/supplierController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createSupplierSchema, updateSupplierSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listSuppliers));
router.post("/", requireRoles("superadmin", "admin"), validate(createSupplierSchema), asyncHandler(createSupplier));
router.put("/:id", requireRoles("superadmin", "admin"), validate(updateSupplierSchema), asyncHandler(updateSupplier));
router.delete("/:id", requireRoles("superadmin", "admin"), asyncHandler(deactivateSupplier));
router.patch("/:id/reactivate", requireRoles("superadmin", "admin"), asyncHandler(reactivateSupplier));

export default router;

import { Router } from "express";
import { createSupplier, listSuppliers } from "../controllers/supplierController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createSupplierSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listSuppliers));
router.post("/", requireRoles("superadmin", "admin"), validate(createSupplierSchema), asyncHandler(createSupplier));

export default router;

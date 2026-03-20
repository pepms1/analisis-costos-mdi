import { Router } from "express";
import { createAdjustment, listAdjustments } from "../controllers/adjustmentController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createAdjustmentSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listAdjustments));
router.post("/", requireRoles("superadmin", "admin"), validate(createAdjustmentSchema), asyncHandler(createAdjustment));

export default router;

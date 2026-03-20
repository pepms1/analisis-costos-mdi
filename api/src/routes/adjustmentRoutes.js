import { Router } from "express";
import {
  createAdjustment,
  deactivateAdjustment,
  listAdjustments,
  reactivateAdjustment,
  updateAdjustment,
} from "../controllers/adjustmentController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createAdjustmentSchema, updateAdjustmentSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listAdjustments));
router.post("/", requireRoles("superadmin", "admin"), validate(createAdjustmentSchema), asyncHandler(createAdjustment));
router.put("/:id", requireRoles("superadmin", "admin"), validate(updateAdjustmentSchema), asyncHandler(updateAdjustment));
router.delete("/:id", requireRoles("superadmin", "admin"), asyncHandler(deactivateAdjustment));
router.patch("/:id/reactivate", requireRoles("superadmin", "admin"), asyncHandler(reactivateAdjustment));

export default router;

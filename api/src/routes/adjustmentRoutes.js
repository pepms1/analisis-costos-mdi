import { Router } from "express";
import {
  createAdjustment,
  deactivateAdjustment,
  listAdjustments,
  reactivateAdjustment,
  updateAdjustment,
} from "../controllers/adjustmentController.js";
import { requirePermission } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createAdjustmentSchema, updateAdjustmentSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.get("/", requirePermission(PERMISSIONS.INFLATION_VIEW), asyncHandler(listAdjustments));
router.post(
  "/",
  requirePermission(PERMISSIONS.INFLATION_MANAGE, { audit: true }),
  validate(createAdjustmentSchema),
  asyncHandler(createAdjustment)
);
router.put(
  "/:id",
  requirePermission(PERMISSIONS.INFLATION_MANAGE, { audit: true }),
  validate(updateAdjustmentSchema),
  asyncHandler(updateAdjustment)
);
router.delete("/:id", requirePermission(PERMISSIONS.INFLATION_MANAGE, { audit: true }), asyncHandler(deactivateAdjustment));
router.patch("/:id/reactivate", requirePermission(PERMISSIONS.INFLATION_MANAGE, { audit: true }), asyncHandler(reactivateAdjustment));

export default router;

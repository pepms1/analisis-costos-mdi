import { Router } from "express";
import {
  applyImportSession,
  createImportSession,
  getImportSession,
  listImportRows,
  saveImportRowDecision,
} from "../controllers/importController.js";
import { requirePermission } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createImportSessionSchema, saveImportRowDecisionSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.post("/import-sessions", requirePermission(PERMISSIONS.PRICES_CREATE), validate(createImportSessionSchema), asyncHandler(createImportSession));
router.get("/import-sessions/:id", requirePermission(PERMISSIONS.PRICES_VIEW), asyncHandler(getImportSession));
router.get("/import-sessions/:id/rows", requirePermission(PERMISSIONS.PRICES_VIEW), asyncHandler(listImportRows));
router.patch(
  "/import-rows/:id/decision",
  requirePermission(PERMISSIONS.PRICES_EDIT),
  validate(saveImportRowDecisionSchema),
  asyncHandler(saveImportRowDecision)
);
router.post("/import-sessions/:id/apply", requirePermission(PERMISSIONS.PRICES_CREATE), asyncHandler(applyImportSession));

export default router;

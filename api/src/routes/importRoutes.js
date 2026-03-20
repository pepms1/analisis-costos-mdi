import { Router } from "express";
import {
  applyImportSession,
  createImportSession,
  generateImportSessionSuggestions,
  getImportSession,
  getImportSessionPreview,
  listImportRows,
  listImportSessionSheets,
  parseImportSessionRows,
  saveImportRowDecision,
  saveImportSessionMapping,
  uploadImportSessionFile,
} from "../controllers/importController.js";
import { requirePermission } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import {
  createImportSessionSchema,
  saveImportRowDecisionSchema,
  saveImportSessionMappingSchema,
  uploadImportSessionFileSchema,
} from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.post("/import-sessions", requirePermission(PERMISSIONS.PRICES_CREATE), validate(createImportSessionSchema), asyncHandler(createImportSession));
router.post(
  "/import-sessions/:id/upload",
  requirePermission(PERMISSIONS.PRICES_CREATE),
  validate(uploadImportSessionFileSchema),
  asyncHandler(uploadImportSessionFile)
);
router.get("/import-sessions/:id", requirePermission(PERMISSIONS.PRICES_VIEW), asyncHandler(getImportSession));
router.get("/import-sessions/:id/sheets", requirePermission(PERMISSIONS.PRICES_VIEW), asyncHandler(listImportSessionSheets));
router.get("/import-sessions/:id/preview", requirePermission(PERMISSIONS.PRICES_VIEW), asyncHandler(getImportSessionPreview));
router.post(
  "/import-sessions/:id/mapping",
  requirePermission(PERMISSIONS.PRICES_EDIT),
  validate(saveImportSessionMappingSchema),
  asyncHandler(saveImportSessionMapping)
);
router.post("/import-sessions/:id/parse", requirePermission(PERMISSIONS.PRICES_EDIT), asyncHandler(parseImportSessionRows));
router.post("/import-sessions/:id/suggestions", requirePermission(PERMISSIONS.PRICES_EDIT), asyncHandler(generateImportSessionSuggestions));
router.get("/import-sessions/:id/rows", requirePermission(PERMISSIONS.PRICES_VIEW), asyncHandler(listImportRows));
router.patch(
  "/import-rows/:id/decision",
  requirePermission(PERMISSIONS.PRICES_EDIT),
  validate(saveImportRowDecisionSchema),
  asyncHandler(saveImportRowDecision)
);
router.post("/import-sessions/:id/apply", requirePermission(PERMISSIONS.PRICES_CREATE), asyncHandler(applyImportSession));

export default router;

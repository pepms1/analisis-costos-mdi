import { Router } from "express";
import {
  createConcept,
  deactivateConcept,
  listConcepts,
  reactivateConcept,
  updateConcept,
} from "../controllers/conceptController.js";
import { requirePermission } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createConceptSchema, updateConceptSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.get("/", requirePermission(PERMISSIONS.CATALOGS_VIEW), asyncHandler(listConcepts));
router.post("/", requirePermission(PERMISSIONS.CATALOGS_MANAGE), validate(createConceptSchema), asyncHandler(createConcept));
router.put("/:id", requirePermission(PERMISSIONS.CATALOGS_MANAGE), validate(updateConceptSchema), asyncHandler(updateConcept));
router.delete("/:id", requirePermission(PERMISSIONS.CATALOGS_MANAGE), asyncHandler(deactivateConcept));
router.patch("/:id/reactivate", requirePermission(PERMISSIONS.CATALOGS_MANAGE), asyncHandler(reactivateConcept));

export default router;

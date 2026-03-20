import { Router } from "express";
import { createConcept, listConcepts, updateConcept } from "../controllers/conceptController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createConceptSchema, updateConceptSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listConcepts));
router.post("/", requireRoles("superadmin", "admin"), validate(createConceptSchema), asyncHandler(createConcept));
router.put("/:id", requireRoles("superadmin", "admin"), validate(updateConceptSchema), asyncHandler(updateConcept));

export default router;

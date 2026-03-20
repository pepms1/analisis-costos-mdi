import { Router } from "express";
import { createQuoteCheck, listQuoteChecks } from "../controllers/quoteCheckController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createQuoteCheckSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listQuoteChecks));
router.post("/", requireRoles("superadmin", "admin"), validate(createQuoteCheckSchema), asyncHandler(createQuoteCheck));

export default router;

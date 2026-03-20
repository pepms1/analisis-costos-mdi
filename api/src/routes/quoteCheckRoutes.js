import { Router } from "express";
import { createQuoteCheck, listQuoteChecks } from "../controllers/quoteCheckController.js";
import { requirePermission } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createQuoteCheckSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.get("/", requirePermission(PERMISSIONS.BUDGETS_VIEW), asyncHandler(listQuoteChecks));
router.post("/", requirePermission(PERMISSIONS.BUDGETS_MANAGE), validate(createQuoteCheckSchema), asyncHandler(createQuoteCheck));

export default router;

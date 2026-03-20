import { Router } from "express";
import { getSummary } from "../controllers/dashboardController.js";
import { requirePermission } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.get("/summary", requirePermission(PERMISSIONS.AUDIT_VIEW), asyncHandler(getSummary));

export default router;

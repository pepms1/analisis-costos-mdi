import { Router } from "express";
import {
  createProject,
  deactivateProject,
  getProjectById,
  listProjects,
  reactivateProject,
  updateProject,
} from "../controllers/projectController.js";
import { requirePermission } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createProjectSchema, updateProjectSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.get("/", requirePermission(PERMISSIONS.BUDGETS_VIEW), asyncHandler(listProjects));
router.get("/:id", requirePermission(PERMISSIONS.BUDGETS_VIEW), asyncHandler(getProjectById));
router.post("/", requirePermission(PERMISSIONS.BUDGETS_MANAGE), validate(createProjectSchema), asyncHandler(createProject));
router.put("/:id", requirePermission(PERMISSIONS.BUDGETS_MANAGE), validate(updateProjectSchema), asyncHandler(updateProject));
router.delete("/:id", requirePermission(PERMISSIONS.BUDGETS_MANAGE), asyncHandler(deactivateProject));
router.patch("/:id/reactivate", requirePermission(PERMISSIONS.BUDGETS_MANAGE), asyncHandler(reactivateProject));

export default router;

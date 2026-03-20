import { Router } from "express";
import {
  createProject,
  getProjectById,
  listProjects,
  updateProject,
} from "../controllers/projectController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createProjectSchema, updateProjectSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listProjects));
router.get("/:id", asyncHandler(getProjectById));
router.post("/", requireRoles("superadmin", "admin"), validate(createProjectSchema), asyncHandler(createProject));
router.put("/:id", requireRoles("superadmin", "admin"), validate(updateProjectSchema), asyncHandler(updateProject));

export default router;

import { Router } from "express";
import {
  createCategory,
  deactivateCategory,
  listCategories,
  reactivateCategory,
  updateCategory,
} from "../controllers/categoryController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createCategorySchema, updateCategorySchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listCategories));
router.post("/", requireRoles("superadmin", "admin"), validate(createCategorySchema), asyncHandler(createCategory));
router.put("/:id", requireRoles("superadmin", "admin"), validate(updateCategorySchema), asyncHandler(updateCategory));
router.delete("/:id", requireRoles("superadmin", "admin"), asyncHandler(deactivateCategory));
router.patch("/:id/reactivate", requireRoles("superadmin", "admin"), asyncHandler(reactivateCategory));

export default router;

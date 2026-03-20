import { Router } from "express";
import {
  createCategory,
  deactivateCategory,
  listCategories,
  reactivateCategory,
  updateCategory,
} from "../controllers/categoryController.js";
import { requirePermission } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createCategorySchema, updateCategorySchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.get("/", requirePermission(PERMISSIONS.CATALOGS_VIEW), asyncHandler(listCategories));
router.post("/", requirePermission(PERMISSIONS.CATALOGS_MANAGE), validate(createCategorySchema), asyncHandler(createCategory));
router.put("/:id", requirePermission(PERMISSIONS.CATALOGS_MANAGE), validate(updateCategorySchema), asyncHandler(updateCategory));
router.delete("/:id", requirePermission(PERMISSIONS.CATALOGS_MANAGE), asyncHandler(deactivateCategory));
router.patch("/:id/reactivate", requirePermission(PERMISSIONS.CATALOGS_MANAGE), asyncHandler(reactivateCategory));

export default router;

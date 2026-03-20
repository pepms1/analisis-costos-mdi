import { Router } from "express";
import { createCategory, listCategories } from "../controllers/categoryController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createCategorySchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listCategories));
router.post("/", requireRoles("superadmin", "admin"), validate(createCategorySchema), asyncHandler(createCategory));

export default router;

import { Router } from "express";
import { getCurrentUser, login } from "../controllers/authController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { loginSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/login", validate(loginSchema), asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(getCurrentUser));

export default router;

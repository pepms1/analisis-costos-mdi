import { Router } from "express";
import { createUser, listUsers } from "../controllers/userController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createUserSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", requireRoles("superadmin", "admin"), asyncHandler(listUsers));
router.post("/", requireRoles("superadmin"), validate(createUserSchema), asyncHandler(createUser));

export default router;

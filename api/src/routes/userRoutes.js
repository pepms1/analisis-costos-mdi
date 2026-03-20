import { Router } from "express";
import { createUser, deactivateUser, listUsers, updateUser } from "../controllers/userController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createUserSchema, updateUserSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", requireRoles("superadmin", "admin"), asyncHandler(listUsers));
router.post("/", requireRoles("superadmin"), validate(createUserSchema), asyncHandler(createUser));
router.put("/:id", requireRoles("superadmin"), validate(updateUserSchema), asyncHandler(updateUser));
router.delete("/:id", requireRoles("superadmin"), asyncHandler(deactivateUser));

export default router;

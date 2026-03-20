import { Router } from "express";
import { createUser, deactivateUser, listUsers, reactivateUser, updateUser } from "../controllers/userController.js";
import { requirePermission } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createUserSchema, updateUserSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.get("/", requirePermission(PERMISSIONS.USERS_VIEW), asyncHandler(listUsers));
router.post("/", requirePermission(PERMISSIONS.USERS_MANAGE, { audit: true }), validate(createUserSchema), asyncHandler(createUser));
router.put("/:id", requirePermission(PERMISSIONS.USERS_MANAGE, { audit: true }), validate(updateUserSchema), asyncHandler(updateUser));
router.delete("/:id", requirePermission(PERMISSIONS.USERS_MANAGE, { audit: true }), asyncHandler(deactivateUser));
router.patch("/:id/reactivate", requirePermission(PERMISSIONS.USERS_MANAGE, { audit: true }), asyncHandler(reactivateUser));

export default router;

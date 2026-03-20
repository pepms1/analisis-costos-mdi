import { Router } from "express";
import { createPriceRecord, listPriceRecords } from "../controllers/priceRecordController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createPriceRecordSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listPriceRecords));
router.post("/", requireRoles("superadmin", "admin"), validate(createPriceRecordSchema), asyncHandler(createPriceRecord));

export default router;

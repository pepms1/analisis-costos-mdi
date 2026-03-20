import { Router } from "express";
import { createPriceRecord, deletePriceRecord, listPriceRecords, updatePriceRecord } from "../controllers/priceRecordController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createPriceRecordSchema, updatePriceRecordSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listPriceRecords));
router.post("/", requireRoles("superadmin", "admin"), validate(createPriceRecordSchema), asyncHandler(createPriceRecord));
router.put("/:id", requireRoles("superadmin", "admin"), validate(updatePriceRecordSchema), asyncHandler(updatePriceRecord));
router.delete("/:id", requireRoles("superadmin", "admin"), asyncHandler(deletePriceRecord));

export default router;

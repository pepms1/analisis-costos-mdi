import { Router } from "express";
import { createPriceRecord, deletePriceRecord, listPriceRecords, updatePriceRecord } from "../controllers/priceRecordController.js";
import { requirePermission } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { createPriceRecordSchema, updatePriceRecordSchema } from "../schemas/authSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

function requireQuickCaptureForCapturista(req, _res, next) {
  if (req.user?.role !== "capturista") {
    return next();
  }

  const captureFlow = req.headers["x-capture-flow"];
  if (captureFlow !== "quick") {
    return next(new AppError("Capturista solo puede crear desde captura rápida", 403));
  }

  return next();
}

router.get("/", requirePermission(PERMISSIONS.PRICES_VIEW), asyncHandler(listPriceRecords));
router.post(
  "/",
  requirePermission(PERMISSIONS.PRICES_CREATE),
  requireQuickCaptureForCapturista,
  validate(createPriceRecordSchema),
  asyncHandler(createPriceRecord)
);
router.put("/:id", requirePermission(PERMISSIONS.PRICES_EDIT), validate(updatePriceRecordSchema), asyncHandler(updatePriceRecord));
router.delete("/:id", requirePermission(PERMISSIONS.PRICES_DELETE, { audit: true }), asyncHandler(deletePriceRecord));

export default router;

import { Router } from "express";
import { getSummary } from "../controllers/dashboardController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/summary", asyncHandler(getSummary));

export default router;

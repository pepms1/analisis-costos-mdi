import { Router } from "express";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import categoryRoutes from "./categoryRoutes.js";
import conceptRoutes from "./conceptRoutes.js";
import supplierRoutes from "./supplierRoutes.js";
import projectRoutes from "./projectRoutes.js";
import priceRecordRoutes from "./priceRecordRoutes.js";
import adjustmentRoutes from "./adjustmentRoutes.js";
import quoteCheckRoutes from "./quoteCheckRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.use("/auth", authRoutes);
router.use(requireAuth);
router.use("/dashboard", dashboardRoutes);
router.use("/users", userRoutes);
router.use("/categories", categoryRoutes);
router.use("/concepts", conceptRoutes);
router.use("/suppliers", supplierRoutes);
router.use("/projects", projectRoutes);
router.use("/price-records", priceRecordRoutes);
router.use("/adjustments", adjustmentRoutes);
router.use("/quote-checks", quoteCheckRoutes);

export default router;

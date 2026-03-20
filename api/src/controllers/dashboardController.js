import { AdjustmentSetting } from "../models/AdjustmentSetting.js";
import { Concept } from "../models/Concept.js";
import { PriceRecord } from "../models/PriceRecord.js";
import { Project } from "../models/Project.js";
import { Supplier } from "../models/Supplier.js";
import { User } from "../models/User.js";

export async function getSummary(_req, res) {
  const [users, concepts, priceRecords, suppliers, adjustments, projects, priceRecordsWithProject] = await Promise.all([
    User.countDocuments({ isActive: true }),
    Concept.countDocuments(),
    PriceRecord.countDocuments(),
    Supplier.countDocuments({ isActive: true }),
    AdjustmentSetting.countDocuments({ isActive: true }),
    Project.countDocuments({ isActive: true }),
    PriceRecord.countDocuments({ projectId: { $ne: null } }),
  ]);

  res.json({
    users,
    concepts,
    priceRecords,
    suppliers,
    adjustments,
    projects,
    priceRecordsWithProject,
  });
}

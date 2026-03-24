import { Project } from "../models/Project.js";
import { AppError } from "../utils/AppError.js";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listProjects(req, res) {
  const query = {};
  const status = req.query.status;

  if (status === "active") {
    query.isActive = true;
  } else if (status === "inactive") {
    query.isActive = false;
  }

  if (req.query.activeOnly === "1") {
    query.isActive = true;
  }

  const items = await Project.find(query)
    .collation({ locale: "es", strength: 1 })
    .sort({ name: 1, createdAt: -1 });
  res.json({
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      clientName: item.clientName,
      location: item.location,
      notes: item.notes,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  });
}

export async function getProjectById(req, res) {
  const item = await Project.findById(req.params.id);

  if (!item) {
    throw new AppError("Project not found", 404);
  }

  res.json({
    item: {
      id: item.id,
      name: item.name,
      code: item.code,
      clientName: item.clientName,
      location: item.location,
      notes: item.notes,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    },
  });
}

export async function createProject(req, res) {
  const normalizedName = req.validatedBody.name.trim();
  const existing = await Project.findOne({ name: new RegExp(`^${escapeRegExp(normalizedName)}$`, "i") });

  if (existing) {
    throw new AppError("Project name already exists", 409);
  }

  const item = await Project.create({
    ...req.validatedBody,
    name: normalizedName,
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });

  res.status(201).json({
    item: {
      id: item.id,
      name: item.name,
      code: item.code,
      clientName: item.clientName,
      location: item.location,
      notes: item.notes,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    },
  });
}

export async function updateProject(req, res) {
  const normalizedName = req.validatedBody.name.trim();
  const existing = await Project.findOne({
    _id: { $ne: req.params.id },
    name: new RegExp(`^${escapeRegExp(normalizedName)}$`, "i"),
  });

  if (existing) {
    throw new AppError("Project name already exists", 409);
  }

  const item = await Project.findByIdAndUpdate(
    req.params.id,
    {
      ...req.validatedBody,
      name: normalizedName,
      updatedBy: req.user.id,
    },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("Project not found", 404);
  }

  res.json({
    item: {
      id: item.id,
      name: item.name,
      code: item.code,
      clientName: item.clientName,
      location: item.location,
      notes: item.notes,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    },
  });
}


export async function deactivateProject(req, res) {
  const item = await Project.findByIdAndUpdate(
    req.params.id,
    {
      isActive: false,
      updatedBy: req.user.id,
    },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("Project not found", 404);
  }

  res.json({
    item: {
      id: item.id,
      name: item.name,
      code: item.code,
      clientName: item.clientName,
      location: item.location,
      notes: item.notes,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    },
  });
}

export async function reactivateProject(req, res) {
  const item = await Project.findByIdAndUpdate(
    req.params.id,
    {
      isActive: true,
      updatedBy: req.user.id,
    },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("Project not found", 404);
  }

  res.json({
    item: {
      id: item.id,
      name: item.name,
      code: item.code,
      clientName: item.clientName,
      location: item.location,
      notes: item.notes,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    },
  });
}

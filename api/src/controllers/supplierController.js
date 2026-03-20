import { Supplier } from "../models/Supplier.js";
import { AppError } from "../utils/AppError.js";

export async function listSuppliers(_req, res) {
  const items = await Supplier.find().sort({ createdAt: -1 });
  res.json({
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      legalName: item.legalName,
      contactName: item.contactName,
      phone: item.phone,
      email: item.email,
      notes: item.notes,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  });
}

export async function createSupplier(req, res) {
  const item = await Supplier.create({
    ...req.validatedBody,
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });

  res.status(201).json({ item });
}

export async function updateSupplier(req, res) {
  const item = await Supplier.findByIdAndUpdate(
    req.params.id,
    {
      ...req.validatedBody,
      updatedBy: req.user.id,
    },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("Supplier not found", 404);
  }

  res.json({ item });
}

export async function deactivateSupplier(req, res) {
  const item = await Supplier.findByIdAndUpdate(
    req.params.id,
    {
      isActive: false,
      updatedBy: req.user.id,
    },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("Supplier not found", 404);
  }

  res.json({ item });
}

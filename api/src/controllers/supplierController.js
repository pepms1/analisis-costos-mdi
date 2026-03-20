import { Supplier } from "../models/Supplier.js";

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

import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";

function toPayload(item) {
  return {
    id: item.id,
    name: item.name,
    email: item.email,
    role: item.role,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function listUsers(req, res) {
  const status = req.query.status || "active";
  const query = {};
  if (status === "active") query.isActive = true;
  if (status === "inactive") query.isActive = false;
  const items = await User.find(query)
    .select("-passwordHash")
    .collation({ locale: "es", strength: 1 })
    .sort({ name: 1, createdAt: -1 });
  res.json({ items: items.map(toPayload) });
}

export async function createUser(req, res) {
  const { name, email, password, role } = req.validatedBody;
  const existing = await User.findOne({ email: email.toLowerCase() });

  if (existing) {
    throw new AppError("Email already exists", 409);
  }

  const passwordHash = await User.buildPasswordHash(password);
  const item = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role,
  });

  res.status(201).json({ item: toPayload(item) });
}

export async function updateUser(req, res) {
  const { name, email, role, password } = req.validatedBody;
  const normalizedEmail = email.toLowerCase();

  const existing = await User.findOne({
    _id: { $ne: req.params.id },
    email: normalizedEmail,
  });

  if (existing) {
    throw new AppError("Email already exists", 409);
  }

  const payload = {
    name,
    email: normalizedEmail,
    role,
  };

  if (password) {
    payload.passwordHash = await User.buildPasswordHash(password);
  }

  const item = await User.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true,
  });

  if (!item) {
    throw new AppError("User not found", 404);
  }

  res.json({ item: toPayload(item) });
}

export async function deactivateUser(req, res) {
  if (req.user.id === req.params.id) {
    throw new AppError("Cannot deactivate your own user", 400);
  }

  const item = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("User not found", 404);
  }

  res.json({ item: toPayload(item) });
}

export async function reactivateUser(req, res) {
  const item = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: true },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new AppError("User not found", 404);
  }

  res.json({ item: toPayload(item) });
}

import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";

export async function listUsers(_req, res) {
  const items = await User.find().select("-passwordHash").sort({ createdAt: -1 });
  res.json({ items });
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

  res.status(201).json({
    item: {
      id: item.id,
      name: item.name,
      email: item.email,
      role: item.role,
      isActive: item.isActive,
      createdAt: item.createdAt,
    },
  });
}

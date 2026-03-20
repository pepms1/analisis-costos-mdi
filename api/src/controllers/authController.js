import { getRolePermissions } from "../utils/permissions.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { createAuthToken } from "../services/authService.js";

export async function login(req, res) {
  const { email, password } = req.validatedBody;
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user || !user.isActive) {
    throw new AppError("Invalid credentials", 401);
  }

  const isValid = await user.comparePassword(password);

  if (!isValid) {
    throw new AppError("Invalid credentials", 401);
  }

  const token = createAuthToken(user);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: getRolePermissions(user.role),
    },
  });
}

export async function getCurrentUser(req, res) {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      permissions: getRolePermissions(req.user.role),
      isActive: req.user.isActive,
    },
  });
}

import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { getRolePermissions, hasAllPermissions, hasAnyPermission } from "../utils/permissions.js";
import { logAuthorizationEvent } from "../utils/auditLogger.js";

export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("Authentication required", 401));
  }

  const token = header.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub).select("-passwordHash");

    if (!user || !user.isActive) {
      return next(new AppError("User is not available", 401));
    }

    req.user = {
      ...user.toObject(),
      id: user.id,
      permissions: getRolePermissions(user.role),
    };

    next();
  } catch (_error) {
    next(new AppError("Invalid token", 401));
  }
}

export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError("Insufficient permissions", 403));
    }

    next();
  };
}

export function requirePermission(permission, options = {}) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    const permissions = Array.isArray(permission) ? permission : [permission];
    const checkFn = options.mode === "all" ? hasAllPermissions : hasAnyPermission;

    if (!checkFn(req.user, permissions)) {
      logAuthorizationEvent({
        user: req.user,
        action: req.method,
        module: req.baseUrl,
        result: "denied",
        meta: { requiredPermissions: permissions, path: req.originalUrl },
      });
      return next(new AppError("Insufficient permissions", 403));
    }

    if (options.audit) {
      logAuthorizationEvent({
        user: req.user,
        action: req.method,
        module: req.baseUrl,
        result: "allowed",
        meta: { requiredPermissions: permissions, path: req.originalUrl },
      });
    }

    next();
  };
}

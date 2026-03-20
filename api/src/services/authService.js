import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function createAuthToken(user) {
  return jwt.sign(
    {
      role: user.role,
      email: user.email,
    },
    env.jwtSecret,
    {
      subject: user.id,
      expiresIn: env.jwtExpiresIn,
    }
  );
}

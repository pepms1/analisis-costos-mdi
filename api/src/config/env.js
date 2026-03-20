import dotenv from "dotenv";

dotenv.config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  mongoUri: required("MONGODB_URI"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  seedSuperadminName: process.env.SEED_SUPERADMIN_NAME || "Super Admin",
  seedSuperadminEmail: process.env.SEED_SUPERADMIN_EMAIL || "admin@example.com",
  seedSuperadminPassword: process.env.SEED_SUPERADMIN_PASSWORD || "ChangeMe123!",
};

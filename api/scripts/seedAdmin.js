import { connectToDatabase } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { User } from "../src/models/User.js";

async function seed() {
  await connectToDatabase();

  const existing = await User.findOne({ email: env.seedSuperadminEmail.toLowerCase() });

  if (existing) {
    console.log(`Superadmin already exists: ${existing.email}`);
    process.exit(0);
  }

  const passwordHash = await User.buildPasswordHash(env.seedSuperadminPassword);

  const user = await User.create({
    name: env.seedSuperadminName,
    email: env.seedSuperadminEmail.toLowerCase(),
    passwordHash,
    role: "superadmin",
  });

  console.log(`Superadmin created: ${user.email}`);
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed", error);
  process.exit(1);
});

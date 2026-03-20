import { connectToDatabase } from "../src/config/db.js";
import { User } from "../src/models/User.js";

async function migrateUserRoles() {
  await connectToDatabase();

  const users = await User.find({}).sort({ createdAt: 1 });
  if (!users.length) {
    console.log("No users found. Skipping migration.");
    process.exit(0);
  }

  const hasSuperadmin = users.some((user) => user.role === "superadmin");

  for (const [index, user] of users.entries()) {
    let nextRole = user.role;

    if (!nextRole) {
      nextRole = "viewer";
    }

    if (!hasSuperadmin && index === 0) {
      nextRole = "superadmin";
    }

    if (nextRole !== user.role) {
      user.role = nextRole;
      await user.save();
      console.log(`Updated role for ${user.email}: ${nextRole}`);
    }
  }

  console.log("Role migration completed.");
  process.exit(0);
}

migrateUserRoles().catch((error) => {
  console.error("Role migration failed", error);
  process.exit(1);
});

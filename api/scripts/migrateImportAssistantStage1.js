import mongoose from "mongoose";
import { connectToDatabase } from "../src/config/db.js";
import { ImportSession } from "../src/models/ImportSession.js";
import { ImportRow } from "../src/models/ImportRow.js";
import { ImportRowSuggestion } from "../src/models/ImportRowSuggestion.js";
import { ImportRowDecision } from "../src/models/ImportRowDecision.js";

async function run() {
  await connectToDatabase();

  await Promise.all([
    ImportSession.createCollection(),
    ImportRow.createCollection(),
    ImportRowSuggestion.createCollection(),
    ImportRowDecision.createCollection(),
  ]);

  await Promise.all([
    ImportSession.syncIndexes(),
    ImportRow.syncIndexes(),
    ImportRowSuggestion.syncIndexes(),
    ImportRowDecision.syncIndexes(),
  ]);

  console.log("Import assistant stage 1 migration completed");
}

run()
  .catch((error) => {
    console.error("Import assistant stage 1 migration failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

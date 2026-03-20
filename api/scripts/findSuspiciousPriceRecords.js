import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { PriceRecord } from "../src/models/PriceRecord.js";

function expectedFromCaptured(capturedAmount) {
  if (typeof capturedAmount !== "string") return null;
  const trimmed = capturedAmount.trim();
  if (!/^\d+(?:\.\d{2})$/.test(trimmed)) return null;
  return Number(trimmed);
}

async function run() {
  await mongoose.connect(env.mongoUri);

  const records = await PriceRecord.find({}).select("conceptId priceDate originalAmount capturedAmount originalAmountCents").lean();

  const suspicious = records.filter((record) => {
    if (!record.capturedAmount) return true;
    const expected = expectedFromCaptured(record.capturedAmount);
    if (expected === null) return true;

    const centsAmount = Number.isSafeInteger(record.originalAmountCents) ? record.originalAmountCents / 100 : null;
    const baseAmount = centsAmount ?? record.originalAmount;
    return Math.abs(baseAmount - expected) > 0.000001;
  });

  console.log(JSON.stringify({ total: records.length, suspicious: suspicious.length, examples: suspicious.slice(0, 20) }, null, 2));
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});

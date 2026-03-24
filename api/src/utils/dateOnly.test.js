import test from "node:test";
import assert from "node:assert/strict";
import { parseDateOnly, toDateOnlyString } from "./dateOnly.js";

test("parseDateOnly creates a UTC midnight date from YYYY-MM-DD", () => {
  const parsed = parseDateOnly("2026-03-24", { fieldName: "priceDate" });

  assert.equal(parsed.toISOString(), "2026-03-24T00:00:00.000Z");
  assert.equal(toDateOnlyString(parsed), "2026-03-24");
});

test("parseDateOnly supports inclusive end-of-day ranges", () => {
  const parsed = parseDateOnly("2026-03-24", { fieldName: "dateTo", endOfDay: true });

  assert.equal(parsed.toISOString(), "2026-03-24T23:59:59.999Z");
});

test("toDateOnlyString remains stable for Mexico timezone formatting", () => {
  const selectedDate = "2026-03-24";
  const storedUtc = parseDateOnly(selectedDate);

  const localFormatted = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(storedUtc);

  const utcFormatted = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeZone: "UTC",
  }).format(storedUtc);

  assert.notEqual(localFormatted, utcFormatted);
  assert.equal(toDateOnlyString(storedUtc), selectedDate);
});

test("parseDateOnly rejects impossible or malformed dates", () => {
  assert.throws(() => parseDateOnly("2026-02-31", { fieldName: "priceDate" }));
  assert.throws(() => parseDateOnly("03/24/2026", { fieldName: "priceDate" }));
});

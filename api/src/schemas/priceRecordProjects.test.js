import test from "node:test";
import assert from "node:assert/strict";
import { createPriceRecordSchema } from "./authSchemas.js";
import { normalizeProjectIdsInput } from "../controllers/priceRecordController.js";

const basePayload = {
  mainType: "material",
  categoryId: "category-1",
  conceptId: "concept-1",
  unit: "pieza",
  priceDate: "2026-03-24",
  amount: 120,
};

const idA = "507f1f77bcf86cd799439011";
const idB = "507f191e810c19729de860ea";
const idC = "507f191e810c19729de860eb";

test("createPriceRecordSchema accepts no projects, legacy projectId and multiple projectIds", () => {
  const noProject = createPriceRecordSchema.parse(basePayload);
  assert.equal(noProject.projectId, undefined);
  assert.equal(noProject.projectIds, undefined);

  const legacy = createPriceRecordSchema.parse({ ...basePayload, projectId: idA });
  assert.equal(legacy.projectId, idA);

  const multiple = createPriceRecordSchema.parse({ ...basePayload, projectIds: [idA, idB] });
  assert.deepEqual(multiple.projectIds, [idA, idB]);
});

test("createPriceRecordSchema rejects duplicated and invalid projectIds", () => {
  assert.throws(
    () => createPriceRecordSchema.parse({ ...basePayload, projectIds: [idA, idA] }),
    /duplicated ids/
  );

  assert.throws(
    () => createPriceRecordSchema.parse({ ...basePayload, projectIds: ["not-an-objectid"] }),
    /Invalid ObjectId/
  );
});

test("normalizeProjectIdsInput removes empty values and keeps insertion order", () => {
  const normalized = normalizeProjectIdsInput([idA, "", "  ", null, undefined, idB], idC);
  assert.deepEqual(normalized, [idA, idB, idC]);
});

test("normalizeProjectIdsInput avoids duplicating legacy projectId when already present in projectIds", () => {
  const normalized = normalizeProjectIdsInput([idA, idB], idA);
  assert.deepEqual(normalized, [idA, idB]);
});

test("normalizeProjectIdsInput preserves duplicates that come from projectIds array", () => {
  const normalized = normalizeProjectIdsInput([idA, idA], idA);
  assert.deepEqual(normalized, [idA, idA]);
});

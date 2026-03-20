import test from "node:test";
import assert from "node:assert/strict";
import { detectEmbeddedDimensions } from "./importParsing.js";

test("detecta 60x60 sin unidad explícita e infiere cm", () => {
  const result = detectEmbeddedDimensions("tapa cisterna 60x60");

  assert.equal(result.detectedDimensions?.rawPattern, "60x60");
  assert.equal(result.detectedDimensions?.sourceUnit, "cm");
  assert.equal(result.detectedDimensions?.lengthM, 0.6);
  assert.equal(result.detectedDimensions?.widthM, 0.6);
  assert.equal(result.detectedDimensions?.areaM2, 0.36);
  assert.equal(result.applicationSuggestion?.suggestedApplicationUnit, "m2");
});

test("respeta unidad explícita mm", () => {
  const result = detectEmbeddedDimensions("loseta 600x600 mm");

  assert.equal(result.detectedDimensions?.sourceUnit, "mm");
  assert.equal(result.detectedDimensions?.lengthM, 0.6);
  assert.equal(result.detectedDimensions?.widthM, 0.6);
  assert.equal(result.detectedDimensions?.areaM2, 0.36);
});

test("interpreta decimales sin unidad como metros", () => {
  const result = detectEmbeddedDimensions("panel 0.60 x 1.20");

  assert.equal(result.detectedDimensions?.sourceUnit, "m");
  assert.equal(result.detectedDimensions?.lengthM, 0.6);
  assert.equal(result.detectedDimensions?.widthM, 1.2);
  assert.equal(result.detectedDimensions?.areaM2, 0.72);
});

test("no inventa medidas cuando no hay patrón", () => {
  const result = detectEmbeddedDimensions("tubo galvanizado cedula 40");

  assert.equal(result.detectedDimensions, null);
  assert.equal(result.applicationSuggestion?.suggestedApplicationUnit, null);
});

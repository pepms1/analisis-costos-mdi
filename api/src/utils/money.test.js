import test from "node:test";
import assert from "node:assert/strict";
import { parseMoneyInput } from "./money.js";
import { buildPricingPayload } from "./normalization.js";

test("parseMoneyInput preserves exact manual values in 2 decimals", () => {
  assert.deepEqual(parseMoneyInput("2400"), {
    cents: 240000,
    normalizedAmount: 2400,
    normalizedString: "2400.00",
  });
  assert.deepEqual(parseMoneyInput("100.1"), {
    cents: 10010,
    normalizedAmount: 100.1,
    normalizedString: "100.10",
  });
  assert.deepEqual(parseMoneyInput("99.99"), {
    cents: 9999,
    normalizedAmount: 99.99,
    normalizedString: "99.99",
  });
});

test("parseMoneyInput rejects more than 2 decimals instead of hidden rounding", () => {
  assert.throws(() => parseMoneyInput("100.105"));
});

test("buildPricingPayload keeps original amount while derived values are separated", () => {
  const payload = buildPricingPayload({
    calculationType: "area_based",
    dimensions: { largo: 2, ancho: 2, measurementUnit: "m" },
    pricingMode: "total_price",
    amount: 2400,
    requiresDimensions: true,
  });

  assert.equal(payload.originalAmount, 2400);
  assert.equal(payload.totalPrice, 2400);
  assert.equal(payload.unitPrice, 600);
  assert.equal(payload.normalizedPrice, 600);
});

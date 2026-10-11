// Money rules: fares, food fees, commission and the food-order cash split.
// Cases live in test/fixtures/money-cases.json and are shared with the client test
// (client/src/utils/__tests__/money.test.ts) so the duplicated rules cannot drift apart.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateFare, calculateFoodDeliveryFee } from "../utils/mapUtils.js";
import { computeFoodServiceFee } from "../utils/foodServiceFee.js";
import { buildEarningsBreakdown } from "../utils/earningsBreakdown.js";
import {
  buildCourierCashCollection,
  computeFoodOrderSplit,
} from "../utils/foodOrderSettlement.js";

const cases = JSON.parse(
  readFileSync(new URL("./fixtures/money-cases.json", import.meta.url), "utf8")
);
const ratesFor = (key) => (key === "rates" ? cases.rates : undefined);
const round2 = (n) => Math.round(n * 100) / 100;

test("ride fares by vehicle", () => {
  for (const c of cases.fares) {
    const got = calculateFare(c.distanceKm, ratesFor(c.rates));
    for (const [vehicle, expected] of Object.entries(c.expected)) {
      assert.equal(round2(got[vehicle]), expected, `${vehicle} @ ${c.distanceKm} km`);
    }
  }
});

test("food delivery fee", () => {
  for (const c of cases.foodDelivery) {
    assert.equal(round2(calculateFoodDeliveryFee(c.distanceKm, ratesFor(c.rates))), c.expected);
  }
});

test("food service fee is clamped and rounded to the pesewa", () => {
  for (const c of cases.serviceFee) {
    const fee = computeFoodServiceFee(c.subtotal, {
      foodServiceFeeRate: c.rate,
      foodServiceFeeMin: c.min,
      foodServiceFeeMax: c.max,
    });
    assert.equal(fee, c.expected, `subtotal ${c.subtotal}`);
    assert.equal(fee, round2(fee), "no float noise");
  }
});

test("rider earnings: commission + net always equal the fare", () => {
  for (const c of cases.earnings) {
    const b = buildEarningsBreakdown(c.fare, c.rate);
    assert.equal(b.commissionAmount, c.expected.commissionAmount);
    assert.equal(b.netEarning, c.expected.netEarning);
    assert.equal(b.commissionPercent, c.expected.commissionPercent);
    assert.equal(round2(b.commissionAmount + b.netEarning), round2(c.fare));
  }
});

test("food order split and courier cash collection", () => {
  for (const c of cases.foodSplit) {
    const split = computeFoodOrderSplit(c.order, c.settings);
    assert.equal(split.restaurantNet, c.expected.restaurantNet);
    assert.equal(split.riderNet, c.expected.riderNet);
    assert.equal(split.platformNet, c.expected.platformNet);

    // Every cedi the customer pays is accounted for: store + rider + platform.
    assert.equal(
      round2(split.restaurantNet + split.riderNet + split.platformNet),
      round2(c.order.total)
    );

    const cash = buildCourierCashCollection({ ...c.order, ...split });
    assert.deepEqual(cash, c.cash);
    assert.equal(
      buildCourierCashCollection({ ...c.order, ...split, paymentMethod: "MOBILE_MONEY" }),
      null,
      "MoMo orders have no cash to collect"
    );
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import FoodOrder from "../models/FoodOrder.js";
import {
  laundryOptionsFor,
  laundryReturnBy,
  normalizeLaundryService,
  readLaundryOptions,
} from "../utils/laundryOptions.js";
import { applyLaundryDecision, laundryExtraFee, refreshOrderTotals } from "../utils/laundryOrders.js";

const SETTINGS = { foodServiceFeeRate: 0.08, foodServiceFeeMin: 2, foodServiceFeeMax: 12 };

test("laundry options: defaults, edits and their limits", () => {
  assert.deepEqual(laundryOptionsFor({}), { standardHours: 48, expressEnabled: false, expressFee: 0, expressHours: 24 });
  const next = readLaundryOptions({ expressEnabled: true, expressFee: "10" }, {});
  assert.equal(next.expressEnabled, true);
  assert.equal(next.expressFee, 10);
  assert.throws(() => readLaundryOptions({ expressEnabled: true, expressHours: 48 }, {}), /faster/);
  assert.throws(() => readLaundryOptions({ expressFee: -1 }, {}), /Express fee/);
  assert.throws(() => readLaundryOptions({ standardHours: 0 }, {}), /between/);
  assert.equal(normalizeLaundryService("wash_iron"), "WASH_IRON");
  assert.equal(normalizeLaundryService("bleach"), null);
  assert.equal(laundryReturnBy(new Date("2026-11-10T10:00:00Z"), 24).toISOString(), "2026-11-11T10:00:00.000Z");
});

test("laundry express fee is part of the subtotal, and dropped when the wash is declined", () => {
  const order = new FoodOrder({
    customer: "507f1f77bcf86cd799439011",
    restaurant: "507f1f77bcf86cd799439012",
    restaurantName: "Clean Touch",
    items: [{ name: "Shirt", price: 5, quantity: 4 }],
    subtotal: 30,
    deliveryFee: 18,
    driverFee: 18,
    total: 0,
    delivery: { address: "Osu", latitude: 5.55, longitude: -0.18 },
    laundry: { estimatedSubtotal: 30, estimatedItemCount: 4, express: true, expressFee: 10, priceStatus: "awaiting_customer" },
  });
  assert.equal(laundryExtraFee(order), 10);
  refreshOrderTotals(order, SETTINGS);
  assert.equal(order.subtotal, 30);
  applyLaundryDecision(order, "decline", SETTINGS);
  assert.equal(order.subtotal, 0);
  assert.equal(order.total, 18);
});

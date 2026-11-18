import test from "node:test";
import assert from "node:assert/strict";
import FoodOrder from "../models/FoodOrder.js";
import {
  PHARMACY_PRICE_HOURS,
  applyPharmacyDecision,
  applyPharmacyQuote,
  pharmacyAnswerBy,
  pharmacyPriceExpired,
  pharmacyQuotePending,
  readPharmacyQuote,
} from "../utils/pharmacyQuote.js";

const SETTINGS = {
  foodServiceFeeRate: 0.08,
  foodServiceFeeMin: 2,
  foodServiceFeeMax: 12,
  restaurantCommissionRate: 0.15,
  riderCommissionRate: 0.15,
};

const request = () =>
  new FoodOrder({
    customer: "507f1f77bcf86cd799439011",
    restaurant: "507f1f77bcf86cd799439012",
    restaurantName: "Care Pharmacy",
    items: [],
    subtotal: 0,
    serviceFee: 0,
    deliveryFee: 15,
    driverFee: 15,
    total: 15,
    restaurantCommissionRate: 0.15,
    delivery: { address: "Osu", latitude: 5.55, longitude: -0.18 },
    pharmacyQuote: { request: "Amoxicillin 500mg" },
  });

test("pharmacy quote: reads lines, skips empty rows, refuses bad ones", () => {
  const q = readPharmacyQuote({
    items: [
      { name: "  Amoxicillin  500mg ", quantity: "2", price: "12.5" },
      { name: "", price: "" },
    ],
    unavailable: ["Cough syrup", ""],
    note: " Take after food ",
  });
  assert.deepEqual(q.items, [{ menuItem: null, name: "Amoxicillin 500mg", price: 12.5, quantity: 2, modifiers: [] }]);
  assert.deepEqual(q.unavailable, ["Cough syrup"]);
  assert.equal(q.note, "Take after food");
  assert.throws(() => readPharmacyQuote({ items: [] }), /at least one medicine/);
  assert.throws(() => readPharmacyQuote({ items: [{ name: "Paracetamol", price: 0 }] }), /price for Paracetamol/);
  assert.throws(() => readPharmacyQuote({ items: [{ price: 4 }] }), /name/);
});

test("pharmacy quote: the price fills in fees and total; approve, or decline", () => {
  const order = request();
  assert.equal(pharmacyQuotePending(order), true);
  applyPharmacyQuote(order, readPharmacyQuote({ items: [{ name: "Amoxicillin", quantity: 2, price: 20 }] }), SETTINGS);
  assert.equal(order.subtotal, 40);
  assert.equal(order.serviceFee, 3.2);
  assert.equal(order.total, 58.2);
  assert.equal(order.pharmacyQuote.priceStatus, "awaiting_customer");
  assert.ok(order.restaurantNet > 0 && order.restaurantNet < 40);

  // The pharmacist can change the price until the customer answers.
  applyPharmacyQuote(order, readPharmacyQuote({ items: [{ name: "Amoxicillin", quantity: 1, price: 20 }] }), SETTINGS);
  assert.equal(order.subtotal, 20);

  applyPharmacyDecision(order, "approve");
  assert.equal(order.pharmacyQuote.priceStatus, "approved");
  assert.equal(pharmacyQuotePending(order), false);
  assert.throws(() => applyPharmacyQuote(order, readPharmacyQuote({ items: [{ name: "X", price: 1 }] }), SETTINGS), /already answered/);
  assert.throws(() => applyPharmacyDecision(order, "decline"), /no price/);

  const other = request();
  assert.throws(() => applyPharmacyDecision(other, "approve"), /no price/);
});

test("pharmacy quote: the customer has a set time to approve; a new price restarts it", () => {
  const HOUR = 3_600_000;
  const t0 = new Date("2026-11-18T10:00:00Z");
  const order = request();
  const quote = readPharmacyQuote({ items: [{ name: "Paracetamol", quantity: 1, price: 8 }] });
  applyPharmacyQuote(order, quote, SETTINGS, t0);
  assert.equal(order.pharmacyQuote.answerBy.getTime(), t0.getTime() + PHARMACY_PRICE_HOURS * HOUR);

  const justBefore = new Date(t0.getTime() + PHARMACY_PRICE_HOURS * HOUR - 1000);
  const after = new Date(t0.getTime() + PHARMACY_PRICE_HOURS * HOUR + 1000);
  assert.equal(pharmacyPriceExpired(order, justBefore), false);
  assert.equal(pharmacyPriceExpired(order, after), true);

  // Too late to approve…
  assert.throws(() => applyPharmacyDecision(order, "approve", after), /expired/);
  assert.equal(order.pharmacyQuote.priceStatus, "awaiting_customer");

  // …but the pharmacist changing the price gives a fresh window.
  const t1 = new Date(t0.getTime() + 90 * 60_000);
  applyPharmacyQuote(order, quote, SETTINGS, t1);
  assert.equal(pharmacyPriceExpired(order, after), false);
  applyPharmacyDecision(order, "approve", after);
  assert.equal(order.pharmacyQuote.priceStatus, "approved");
  assert.equal(pharmacyPriceExpired(order, new Date(t1.getTime() + 10 * HOUR)), false); // answered
});

test("pharmacy quote: declining late is still allowed; older prices without answerBy use quotedAt", () => {
  const HOUR = 3_600_000;
  const t0 = new Date("2026-11-18T10:00:00Z");
  const order = request();
  applyPharmacyQuote(order, readPharmacyQuote({ items: [{ name: "ORS", quantity: 4, price: 3 }] }), SETTINGS, t0);
  applyPharmacyDecision(order, "decline", new Date(t0.getTime() + 5 * HOUR));
  assert.equal(order.pharmacyQuote.priceStatus, "declined");

  const old = { priceStatus: "awaiting_customer", quotedAt: t0, answerBy: null };
  assert.equal(pharmacyAnswerBy(old).getTime(), t0.getTime() + PHARMACY_PRICE_HOURS * HOUR);
  assert.equal(pharmacyPriceExpired({ pharmacyQuote: old }, new Date(t0.getTime() + 3 * HOUR)), true);
  assert.equal(pharmacyPriceExpired({ pharmacyQuote: { priceStatus: "awaiting_pharmacy" } }), false);
});

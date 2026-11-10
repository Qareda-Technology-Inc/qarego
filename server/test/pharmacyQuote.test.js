import test from "node:test";
import assert from "node:assert/strict";
import FoodOrder from "../models/FoodOrder.js";
import {
  applyPharmacyDecision,
  applyPharmacyQuote,
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

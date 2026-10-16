// Courier pay when a store cancels after the courier started the trip.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { courierCancelPayAmount } from "../utils/courierCancelPay.js";

const rider = "6acabfc8eaa911b02e8891de";

test("no courier assigned: nothing due", () => {
  assert.equal(courierCancelPayAmount({ rider: null, status: "SEARCHING_FOR_RIDER", fare: 10 }), 0);
  assert.equal(courierCancelPayAmount(null), 0);
});

test("accepted, not yet at pickup: half the fee", () => {
  assert.equal(courierCancelPayAmount({ rider, status: "START", fare: 10.52 }), 5.26);
  assert.equal(courierCancelPayAmount({ rider, status: "START", fare: 15 }), 7.5);
});

test("at pickup/door or carrying the order: full fee", () => {
  assert.equal(courierCancelPayAmount({ rider, status: "ARRIVED", fare: 15 }), 15);
  assert.equal(courierCancelPayAmount({ rider, status: "IN_PROGRESS", fare: 10.52 }), 10.52);
});

test("completed or free trips: nothing due", () => {
  assert.equal(courierCancelPayAmount({ rider, status: "COMPLETED", fare: 15 }), 0);
  assert.equal(courierCancelPayAmount({ rider, status: "START", fare: 0 }), 0);
});

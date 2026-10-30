// Rider per-trip breakdown for store-order courier rides: built from the order's riderNet,
// never from the COMMISSION_DEBIT (which for cash store orders is QareGO's platformNet).
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildEarningsBreakdownForStoreRide,
  buildEarningsBreakdownFromCommissionTxn,
  isStoreCourierRide,
} from "../utils/earningsBreakdown.js";

test("food courier: rider keeps the whole delivery fee at 0% commission", () => {
  const b = buildEarningsBreakdownForStoreRide({ fare: 10.51, serviceType: "FOOD" }, { riderNet: 10.51 });
  assert.deepEqual(b, {
    grossFare: 10.51,
    commissionRate: 0,
    commissionPercent: 0,
    commissionAmount: 0,
    netEarning: 10.51,
    serviceType: "FOOD",
  });
});

test("food courier: commission is fare minus riderNet", () => {
  const b = buildEarningsBreakdownForStoreRide({ fare: 20, serviceType: "FOOD" }, { riderNet: 18 });
  assert.equal(b.commissionAmount, 2);
  assert.equal(b.commissionPercent, 10);
  assert.equal(b.netEarning, 18);
});

test("gas refill: fare and riderNet are split across completed legs", () => {
  // Both legs carry the order's whole delivery fee as their fare.
  const b = buildEarningsBreakdownForStoreRide({ fare: 15, serviceType: "FOOD" }, { riderNet: 15 }, 2);
  assert.equal(b.grossFare, 7.5);
  assert.equal(b.netEarning, 7.5);
  assert.equal(b.commissionAmount, 0);

  const taxed = buildEarningsBreakdownForStoreRide({ fare: 15 }, { riderNet: 13.5 }, 2);
  assert.equal(taxed.grossFare, 7.5);
  assert.equal(taxed.netEarning, 6.75);
  assert.equal(taxed.commissionAmount, 0.75);
  assert.equal(taxed.commissionPercent, 10);
});

test("store order not split yet gives no breakdown", () => {
  assert.equal(buildEarningsBreakdownForStoreRide({ fare: 10 }, { riderNet: null }), null);
  assert.equal(buildEarningsBreakdownForStoreRide({ fare: 10 }, null), null);
});

test("store courier detection", () => {
  assert.equal(isStoreCourierRide({ serviceType: "FOOD" }), true);
  assert.equal(isStoreCourierRide({ serviceType: "DELIVERY", foodOrder: "abc" }), true);
  assert.equal(isStoreCourierRide({ serviceType: "RIDE" }), false);
  assert.equal(isStoreCourierRide({ serviceType: "DELIVERY", foodOrder: null }), false);
});

test("ride/parcel breakdown from the commission debit is unchanged", () => {
  const b = buildEarningsBreakdownFromCommissionTxn({ amount: -1.5, ride: { fare: 10, serviceType: "RIDE" } });
  assert.equal(b.commissionAmount, 1.5);
  assert.equal(b.netEarning, 8.5);
  assert.equal(b.commissionPercent, 15);
});

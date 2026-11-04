// Cooking gas refill by amount (buy GH₵50 of gas instead of a full cylinder).
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGasQuote, getGasConfig, normalizeGasConfigInput } from "../utils/gasOrders.js";

const config = getGasConfig({});
const quote = (extra) =>
  buildGasQuote({ config, settings: {}, mode: "REFILL", sizeKg: 12.5, quantity: 1, distanceKm: 2, ...extra });

test("an amount refill is priced at the amount, one cylinder", () => {
  const q = quote({ amount: 50, quantity: 3 });
  assert.equal(q.gasAmount, 50);
  assert.equal(q.unitPrice, 50);
  assert.equal(q.quantity, 1);
  assert.equal(q.subtotal, 50);
  assert.equal(q.itemName, "GH₵50.00 of gas (12.5 kg cylinder)");
  assert.equal(q.deliveryFee, quote({}).deliveryFee);
});

test("no amount is a full refill, as before", () => {
  const q = quote({ quantity: 2 });
  assert.equal(q.gasAmount, null);
  assert.equal(q.unitPrice, 212.5);
  assert.equal(q.subtotal, 425);
  assert.equal(q.itemName, "12.5 kg gas refill");
});

test("amount must be between the minimum and a full refill", () => {
  assert.throws(() => quote({ amount: 10 }), /smallest amount is GH₵20.00/);
  assert.throws(() => quote({ amount: 0 }), /Enter how much/);
  assert.throws(() => quote({ amount: 300 }), /full 12.5 kg refill is GH₵212.50/);
  assert.equal(quote({ amount: 212.5 }).subtotal, 212.5);
});

test("exchange can't be bought by amount", () => {
  assert.throws(() => quote({ mode: "EXCHANGE", amount: 50 }), /Only a refill/);
});

test("the owner can switch amount refills off or change the minimum", () => {
  const off = getGasConfig({ gas: { amountRefill: { enabled: false } } });
  assert.throws(
    () => buildGasQuote({ config: off, settings: {}, mode: "REFILL", sizeKg: 6, distanceKm: 1, amount: 50 }),
    /not available/
  );
  const saved = normalizeGasConfigInput({
    cylinders: [{ sizeKg: 6, refillPrice: 100, exchangePrice: 110 }],
    amountRefill: { enabled: true, minAmount: 30 },
  });
  assert.deepEqual(saved.amountRefill, { enabled: true, minAmount: 30 });
  assert.throws(
    () => normalizeGasConfigInput({ cylinders: [{ sizeKg: 6, refillPrice: 1, exchangePrice: 1 }], amountRefill: { minAmount: -5 } }),
    /0 or more/
  );
});

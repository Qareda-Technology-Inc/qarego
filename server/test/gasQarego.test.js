// QareGO's own gas: flat delivery fee, no station commission, and a refill's cash split
// between the collection trip (gas money) and the return trip (fees).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGasQuote, getGasConfig, normalizeGasConfigInput } from "../utils/gasOrders.js";
import {
  buildCourierCashCollection,
  buildGasCollectCashCollection,
  computeFoodOrderSplit,
} from "../utils/foodOrderSettlement.js";

const settings = {};

test("gas delivery is one flat fee, whatever the distance", () => {
  const config = getGasConfig({ gas: { delivery: { flatFee: 25 } } });
  const near = buildGasQuote({ config, settings, mode: "REFILL", sizeKg: 6, quantity: 1, distanceKm: 1 });
  const far = buildGasQuote({ config, settings, mode: "EXCHANGE", sizeKg: 6, quantity: 1, distanceKm: 40 });
  assert.equal(near.deliveryFee, 25);
  assert.equal(far.deliveryFee, 25);
});

test("old saved delivery rates fall back to the default flat fee", () => {
  const config = getGasConfig({ gas: { delivery: { baseFare: 10, perKmRate: 3, minimumFare: 15 } } });
  assert.equal(config.delivery.flatFee, 20);
});

test("house store id is kept only when it looks like an id", () => {
  assert.equal(getGasConfig({ gas: { houseStoreId: "abc" } }).houseStoreId, null);
  const id = "64b7f0c2a1b2c3d4e5f60718";
  assert.equal(getGasConfig({ gas: { houseStoreId: id } }).houseStoreId, id);
  const saved = normalizeGasConfigInput({
    houseStoreId: id,
    delivery: { flatFee: 30 },
    cylinders: [{ sizeKg: 6, refillPrice: 100, exchangePrice: 110 }],
  });
  assert.equal(saved.houseStoreId, id);
  assert.equal(saved.delivery.flatFee, 30);
  assert.throws(() =>
    normalizeGasConfigInput({ houseStoreId: "nope", cylinders: [{ sizeKg: 6, refillPrice: 1, exchangePrice: 1 }] })
  );
});

function qaregoRefill() {
  const config = getGasConfig({ gas: { delivery: { flatFee: 20 } } });
  const quote = buildGasQuote({ config, settings, mode: "REFILL", sizeKg: 12.5, quantity: 1, distanceKm: 3 });
  const split = computeFoodOrderSplit(
    { subtotal: quote.subtotal, deliveryFee: quote.deliveryFee, serviceFee: quote.serviceFee },
    settings,
    { stationCommissionRate: 0 }
  );
  return {
    ...split,
    subtotal: quote.subtotal,
    deliveryFee: quote.deliveryFee,
    serviceFee: quote.serviceFee,
    total: quote.total,
    paymentMethod: "CASH",
    gasMode: "REFILL",
    gasByQarego: true,
  };
}

test("QareGO's own store takes no commission on the gas", () => {
  const order = qaregoRefill();
  assert.equal(order.restaurantCommission, 0);
  assert.equal(order.restaurantNet, order.subtotal);
});

test("refill cash: gas money on collection, fees on return, adding up to the total", () => {
  const order = qaregoRefill();
  const collect = buildGasCollectCashCollection(order);
  const ret = buildCourierCashCollection(order);
  assert.deepEqual(collect, {
    collectFromCustomer: order.subtotal,
    payStore: order.subtotal,
    riderKeeps: 0,
    platformShare: 0,
  });
  assert.equal(ret.payStore, 0);
  assert.equal(Math.round((collect.collectFromCustomer + ret.collectFromCustomer) * 100), Math.round(order.total * 100));
  assert.equal(Math.round((ret.riderKeeps + ret.platformShare) * 100), Math.round(ret.collectFromCustomer * 100));
});

test("partner station and exchange orders keep the one-trip cash split", () => {
  const partner = { ...qaregoRefill(), gasByQarego: false };
  assert.equal(buildGasCollectCashCollection(partner), null);
  assert.equal(buildCourierCashCollection(partner).collectFromCustomer, partner.total);
  const exchange = { ...qaregoRefill(), gasMode: "EXCHANGE" };
  assert.equal(buildGasCollectCashCollection(exchange), null);
  assert.equal(buildCourierCashCollection(exchange).payStore, exchange.restaurantNet);
});

test("filling stations: invalid ones are refused on save, nearest come first", async () => {
  const { nearestFillingStations } = await import("../utils/gasOrders.js");
  const base = { cylinders: [{ sizeKg: 6, refillPrice: 100, exchangePrice: 110 }] };
  assert.throws(() => normalizeGasConfigInput({ ...base, fillingStations: [{ name: "", latitude: 5.6, longitude: -0.2 }] }), /name/);
  assert.throws(() => normalizeGasConfigInput({ ...base, fillingStations: [{ name: "No pin" }] }), /on the map/);
  const saved = normalizeGasConfigInput({
    ...base,
    fillingStations: [
      { name: "Far", latitude: 5.8, longitude: -0.2 },
      { name: "Near", latitude: 5.61, longitude: -0.2 },
      { name: "Off", latitude: 5.605, longitude: -0.2, active: false },
      { name: "Other city", latitude: 6.7, longitude: -1.6 },
    ],
  });
  assert.ok(saved.fillingStations.every((f) => f.id));
  const config = getGasConfig({ gas: saved });
  const near = nearestFillingStations(config, 5.6, -0.2, 5);
  assert.deepEqual(near.map((f) => f.name), ["Near", "Far"]); // inactive and >30 km left out
});

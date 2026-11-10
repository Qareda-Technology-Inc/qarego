import test from "node:test";
import assert from "node:assert/strict";
import { normalizeParcelPointInput, sortParcelPoints } from "../utils/parcelPoints.js";

test("parcel point input: requires a name and a map location", () => {
  assert.equal(normalizeParcelPointInput({ latitude: 5.6, longitude: -0.2 }).error, "Name is required");
  assert.equal(normalizeParcelPointInput({ name: "Circle VIP" }).error, "Pick the location on the map");
  assert.equal(normalizeParcelPointInput({ name: "X", latitude: 0, longitude: 0 }).error, "Pick the location on the map");
  const { value } = normalizeParcelPointInput({
    name: "  Circle VIP  ", latitude: "5.57", longitude: "-0.21", kind: "bus_station", hours: " 6am–9pm ",
  });
  assert.deepEqual(
    { name: value.name, kind: value.kind, hours: value.hours, canPickup: value.canPickup, canDrop: value.canDrop, isActive: value.isActive },
    { name: "Circle VIP", kind: "BUS_STATION", hours: "6am–9pm", canPickup: true, canDrop: true, isActive: true }
  );
  assert.equal(normalizeParcelPointInput({ name: "X", latitude: 5, longitude: -0.2, kind: "zoo" }).value.kind, "OTHER");
});

test("parcel point input: must allow pickup or drop-off; partial edits only touch sent fields", () => {
  assert.match(
    normalizeParcelPointInput({ name: "X", latitude: 5, longitude: -0.2, canPickup: false, canDrop: false }).error,
    /at least/
  );
  assert.deepEqual(normalizeParcelPointInput({ isActive: false }, { partial: true }).value, { isActive: false });
});

test("parcel points sort nearest first when a position is given, else by name", () => {
  const pts = [
    { name: "Kumasi STC", latitude: 6.69, longitude: -1.62 },
    { name: "Accra Mall", latitude: 5.62, longitude: -0.17 },
    { name: "Circle VIP", latitude: 5.57, longitude: -0.21 },
  ];
  assert.deepEqual(sortParcelPoints(pts, 5.57, -0.21).map((p) => p.name), ["Circle VIP", "Accra Mall", "Kumasi STC"]);
  assert.equal(sortParcelPoints(pts, 5.57, -0.21)[0].distanceKm, 0);
  assert.deepEqual(sortParcelPoints(pts, NaN, NaN).map((p) => p.name), ["Accra Mall", "Circle VIP", "Kumasi STC"]);
});

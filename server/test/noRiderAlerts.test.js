import test from "node:test";
import assert from "node:assert/strict";
import { noRiderWait } from "../utils/noRiderAlerts.js";
import { getOrderAlertConfig, normalizeOrderAlertsInput } from "../utils/orderWaitAlerts.js";

const config = getOrderAlertConfig({});
const t0 = new Date("2026-11-14T10:00:00Z");

test("no-rider alerts: defaults are parcel 2 min, ride 3 min, store delivery 5 min", () => {
  assert.equal(config.parcelNoRiderMinutes, 2);
  assert.equal(config.rideNoRiderMinutes, 3);
  assert.equal(config.courierNoRiderMinutes, 5);
  const saved = normalizeOrderAlertsInput({ storeReminderMinutes: 3, teamAlertMinutes: 5, parcelNoRiderMinutes: 4, rideNoRiderMinutes: 0 });
  assert.equal(saved.parcelNoRiderMinutes, 4);
  assert.equal(saved.rideNoRiderMinutes, 1); // at least a minute
});

test("no-rider alerts: which clock applies", () => {
  assert.deepEqual(noRiderWait({ serviceType: "RIDE", createdAt: t0 }, null, config), { kind: "ride", minutes: 3, since: t0 });
  assert.equal(noRiderWait({ serviceType: "DELIVERY", createdAt: t0 }, null, config).minutes, 2);
  // Store delivery offered while the food is still being made: not waiting on a rider yet.
  const ride = { foodOrder: "o1", serviceType: "FOOD", createdAt: t0 };
  assert.equal(noRiderWait(ride, { status: "PREPARING" }, config), null);
  const readyAt = new Date("2026-11-14T10:20:00Z");
  const w = noRiderWait(ride, { status: "READY_FOR_PICKUP", timeline: [{ status: "PLACED", at: t0 }, { status: "READY_FOR_PICKUP", at: readyAt }] }, config);
  assert.equal(w.since.getTime(), readyAt.getTime());
  assert.equal(w.minutes, 5);
  // Collect-first legs wait from when the job goes out; cancelled orders never alert.
  assert.equal(noRiderWait({ ...ride, gasLeg: "COLLECT" }, { status: "PREPARING" }, config).since.getTime(), t0.getTime());
  assert.equal(noRiderWait({ ...ride, gasLeg: "COLLECT" }, { status: "CANCELLED" }, config), null);
});

// Orders nobody accepts: alert settings, and the SMS address stores are texted through.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { getOrderAlertConfig, normalizeOrderAlertsInput } from "../utils/orderWaitAlerts.js";
import { smsApiUrl } from "../utils/smsService.js";

test("order alerts default to a 3 min store reminder and a 5 min team alert", () => {
  assert.deepEqual(getOrderAlertConfig({}), { storeReminderMinutes: 3, teamAlertMinutes: 5, rideNoRiderMinutes: 3, parcelNoRiderMinutes: 2, courierNoRiderMinutes: 5, phones: [] });
});

test("team phone numbers are cleaned up and de-duplicated", () => {
  const cfg = normalizeOrderAlertsInput({ phones: ["050 177 4210", "+233501774210", ""], storeReminderMinutes: "2", teamAlertMinutes: 4 });
  assert.deepEqual(cfg, { storeReminderMinutes: 2, teamAlertMinutes: 4, rideNoRiderMinutes: 3, parcelNoRiderMinutes: 2, courierNoRiderMinutes: 5, phones: ["+233501774210"] });
});

test("bad order alert input is refused", () => {
  assert.throws(() => normalizeOrderAlertsInput({ phones: ["call me"] }), /isn't a phone number/);
  assert.throws(() => normalizeOrderAlertsInput({ storeReminderMinutes: 10, teamAlertMinutes: 5 }), /after the store reminder/);
});

test("SMS goes to Arkesel even when the env still has the old misspelled address", () => {
  const saved = process.env.ARKASEL_API_URL;
  process.env.ARKASEL_API_URL = "https://api.arkasel.com/api/v1/sms/send";
  assert.equal(smsApiUrl(), "https://sms.arkesel.com/api/v2/sms/send");
  delete process.env.ARKASEL_API_URL;
  assert.equal(smsApiUrl(), "https://sms.arkesel.com/api/v2/sms/send");
  if (saved === undefined) delete process.env.ARKASEL_API_URL;
  else process.env.ARKASEL_API_URL = saved;
});

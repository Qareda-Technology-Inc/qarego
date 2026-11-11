import test from "node:test";
import assert from "node:assert/strict";
import { appLoginRefusal } from "../utils/appLogin.js";

test("app sign-in: customers, riders and new numbers are let in; vendor, staff and admin numbers aren't", () => {
  assert.equal(appLoginRefusal(null), null);
  assert.equal(appLoginRefusal({ role: "customer" }), null);
  assert.equal(appLoginRefusal({ role: "rider" }), null);
  assert.match(appLoginRefusal({ role: "merchant" }), /vendor account.*merchant portal/);
  assert.match(appLoginRefusal({ role: "cook" }), /kitchen staff/);
  assert.match(appLoginRefusal({ role: "admin" }), /admin account/);
});

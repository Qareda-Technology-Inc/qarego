// App update prompts: which build is told to update, and what admin can save.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getAppVersionConfig, normalizeAppVersionsInput, updateStatus } from "../utils/appVersions.js";

test("nothing set: nobody is prompted, store links default", () => {
  const c = getAppVersionConfig({});
  assert.equal(updateStatus(c.android, 30), "none");
  assert.match(c.android.storeUrl, /play\.google\.com.*com\.qarego\.client/);
  assert.match(c.ios.storeUrl, /apps\.apple\.com/);
});

test("older than minimum is required, older than latest is available", () => {
  const c = getAppVersionConfig({ appVersions: { android: { latestBuild: 37, minBuild: 36 } } });
  assert.equal(updateStatus(c.android, 35), "required");
  assert.equal(updateStatus(c.android, 36), "available");
  assert.equal(updateStatus(c.android, 37), "none");
  assert.equal(updateStatus(c.android, 40), "none");
  assert.equal(updateStatus(c.android, undefined), "none"); // unknown build: never lock anyone out
  assert.equal(updateStatus(c.ios, 1), "none"); // iOS not set
});

test("admin can't require a build newer than the latest", () => {
  assert.throws(() => normalizeAppVersionsInput({ android: { latestBuild: 36, minBuild: 40 } }), /oldest allowed/);
  assert.throws(() => normalizeAppVersionsInput({ ios: { storeUrl: "http://x" } }), /https/);
  const saved = normalizeAppVersionsInput({ android: { latestBuild: "37", minBuild: "" }, message: " New gas flow " });
  assert.deepEqual([saved.android.latestBuild, saved.android.minBuild, saved.message], [37, 0, "New gas flow"]);
});

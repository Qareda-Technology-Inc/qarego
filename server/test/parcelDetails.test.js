import test from "node:test";
import assert from "node:assert/strict";
import { readParcelDetails, parcelSummary, recipientSmsText } from "../utils/parcelDetails.js";

test("parcel details: reads size, contents and fragile; drops unknown values", () => {
  assert.deepEqual(
    readParcelDetails({ parcelSize: "small", parcelCategory: "ELECTRONICS", fragile: true, notifyRecipient: true }, "motorcycle").value,
    { parcelSize: "SMALL", parcelCategory: "ELECTRONICS", fragile: true, notifyRecipient: true }
  );
  assert.deepEqual(readParcelDetails({ parcelSize: "huge", fragile: "yes" }, "motorcycle").value, {
    parcelSize: null, parcelCategory: null, fragile: false, notifyRecipient: false,
  });
  // Older app builds send nothing.
  assert.equal(readParcelDetails({}, "motorcycle").value.parcelSize, null);
});

test("parcel details: large parcels need the tricycle", () => {
  assert.match(readParcelDetails({ parcelSize: "LARGE" }, "motorcycle").error, /tricycle/);
  assert.equal(readParcelDetails({ parcelSize: "LARGE" }, "pragya").value.parcelSize, "LARGE");
});

test("parcel summary and receiver text", () => {
  assert.equal(parcelSummary({ parcelSize: "SMALL", parcelCategory: "ELECTRONICS", fragile: true }), "Small · Phone, electronics · Fragile");
  assert.equal(parcelSummary({}), "");
  const text = recipientSmsText({ senderName: "John Owusu", riderName: "Kwesi Appiah", riderPhone: "0241234567", code: "3307" });
  assert.equal(text, "QareGO: John is sending you a parcel. Rider Kwesi (0241234567) is on the way to collect it. Your delivery code is 3307. Give it to the rider only when you have the parcel.");
});

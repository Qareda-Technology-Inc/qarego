import { sendSMS } from "./smsService.js";
import { normalizePhone } from "./phone.js";

export const PARCEL_SIZES = ["DOCUMENT", "SMALL", "MEDIUM", "LARGE"];
export const PARCEL_CATEGORIES = ["CLOTHES", "ELECTRONICS", "FOOD", "DOCUMENTS", "OTHER"];

const SIZE_WORD = { DOCUMENT: "Document", SMALL: "Small", MEDIUM: "Medium", LARGE: "Large" };
const CATEGORY_WORD = {
  CLOTHES: "Clothes",
  ELECTRONICS: "Phone, electronics",
  FOOD: "Food",
  DOCUMENTS: "Documents",
  OTHER: "Other",
};

/**
 * Size, contents and fragile flag from a parcel booking. Unknown values are dropped
 * (older app builds send none of these). Large parcels need the tricycle.
 */
export function readParcelDetails(body = {}, vehicle) {
  const size = String(body.parcelSize || "").toUpperCase();
  const category = String(body.parcelCategory || "").toUpperCase();
  const out = {
    parcelSize: PARCEL_SIZES.includes(size) ? size : null,
    parcelCategory: PARCEL_CATEGORIES.includes(category) ? category : null,
    fragile: body.fragile === true,
    notifyRecipient: body.notifyRecipient === true,
  };
  if (out.parcelSize === "LARGE" && vehicle !== "pragya") {
    return { error: "Large parcels go by tricycle" };
  }
  return { value: out };
}

/** "Small · Phone, electronics · Fragile" for riders and receipts. */
export function parcelSummary(ride) {
  return [
    SIZE_WORD[ride?.parcelSize],
    CATEGORY_WORD[ride?.parcelCategory],
    ride?.fragile ? "Fragile" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

/** Text for the receiver once a rider has taken the parcel job. */
export function recipientSmsText({ senderName, riderName, riderPhone, code }) {
  const who = firstName(senderName) || "Someone";
  const rider = firstName(riderName);
  const riderBit = rider ? ` Rider ${rider}${riderPhone ? ` (${riderPhone})` : ""} is on the way to collect it.` : "";
  return `QareGO: ${who} is sending you a parcel.${riderBit} Your delivery code is ${code}. Give it to the rider only when you have the parcel.`;
}

/**
 * Texts the receiver of a SEND parcel the delivery code and rider, once, after a rider
 * accepts. Skipped when the customer didn't ask, or the receiver is the customer.
 * Never throws: a failed text must not undo the accept.
 */
export async function notifyParcelRecipient(RideModel, rideId) {
  try {
    const ride = await RideModel.findById(rideId)
      .select("+deliveryOtp serviceType parcelMode notifyRecipient recipientPhone recipientSmsSentAt customer rider")
      .populate("customer", "name phone")
      .populate("rider", "name phone");
    if (!ride || ride.serviceType !== "DELIVERY" || ride.parcelMode !== "SEND") return false;
    if (!ride.notifyRecipient || ride.recipientSmsSentAt || !ride.deliveryOtp) return false;
    const to = normalizePhone(ride.recipientPhone);
    if (!to || to === normalizePhone(ride.customer?.phone)) return false;

    // Claim the send first so a retried accept can't text twice.
    const claimed = await RideModel.updateOne(
      { _id: ride._id, recipientSmsSentAt: null },
      { $set: { recipientSmsSentAt: new Date() } }
    );
    if (!claimed.modifiedCount) return false;

    await sendSMS(
      to,
      recipientSmsText({
        senderName: ride.customer?.name,
        riderName: ride.rider?.name,
        riderPhone: ride.rider?.phone,
        code: ride.deliveryOtp,
      })
    );
    return true;
  } catch (err) {
    console.warn("[parcel] receiver SMS failed:", err?.message || err);
    return false;
  }
}

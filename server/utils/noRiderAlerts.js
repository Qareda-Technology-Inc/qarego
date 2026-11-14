// Jobs no rider has taken. A customer can sit on "searching for a rider" with nobody at QareGO
// knowing, so after a few minutes the team gets the same SMS / email / push as for orders a store
// hasn't accepted (utils/orderWaitAlerts.js). Each job is alerted once. Runs on the food scheduler.
import Ride from "../models/Ride.js";
import Settings from "../models/Settings.js";
import User from "../models/User.js";
import { normalizePhone } from "./phone.js";
import { adminOrigins } from "./portalOrigins.js";
import { getOrderAlertConfig, sendTeamAlert, superAdminEmails } from "./orderWaitAlerts.js";

const MINUTE = 60_000;
/** Older jobs are left alone, so turning this on doesn't text about yesterday's trips. */
const LOOKBACK_MINUTES = 120;

const lastStatusAt = (order, status) => {
  const hit = [...(order?.timeline || [])].reverse().find((t) => t.status === status);
  return hit?.at ? new Date(hit.at) : null;
};

/**
 * Which wait applies to this searching job and when its clock started, or null when it isn't
 * waiting on a rider yet. A store delivery's rider is offered the job while the food is still
 * being made, so its clock starts when the store marks it ready. Collect-first legs (gas refill,
 * laundry) and QareGO's own gas start when the job goes out.
 */
export function noRiderWait(ride, order, config) {
  if (!ride.foodOrder) {
    const minutes = ride.serviceType === "DELIVERY" ? config.parcelNoRiderMinutes : config.rideNoRiderMinutes;
    return { kind: ride.serviceType === "DELIVERY" ? "parcel" : "ride", minutes, since: new Date(ride.createdAt) };
  }
  if (!order || order.status === "CANCELLED" || order.status === "DELIVERED") return null;
  if (ride.gasLeg) return { kind: "store", minutes: config.courierNoRiderMinutes, since: new Date(ride.createdAt) };
  if (order.status !== "READY_FOR_PICKUP") return null;
  const readyAt = lastStatusAt(order, "READY_FOR_PICKUP") || new Date(order.updatedAt);
  return { kind: "store", minutes: config.courierNoRiderMinutes, since: readyAt };
}

const minutesSince = (since, now) => Math.max(1, Math.round((now - since) / MINUTE));

async function alertNoRider(ride, order, wait, team, now) {
  const customer = ride.customer ? await User.findById(ride.customer).select("name phone").lean() : null;
  const onDuty = await User.countDocuments({ role: "rider", isOnline: true, "driverDetails.status": "active" });
  const waited = minutesSince(wait.since, now);
  const what =
    wait.kind === "ride" ? "a ride" : wait.kind === "parcel" ? "a parcel" : `a ${order?.restaurantName || "store"} delivery`;
  const from = ride.pickup?.address || "pickup";
  const to = ride.drop?.address || "drop-off";
  const fare = Number(ride.fare) || 0;
  const pay = ride.paymentMethod === "MOBILE_MONEY" ? "MoMo" : "cash";
  const who = `${customer?.name || "Customer"} ${normalizePhone(customer?.phone) || ""}`.trim();
  const ref = String(ride._id).slice(-6);

  const adminBase = adminOrigins()[0]?.replace(/\/$/, "");
  const link = adminBase
    ? order
      ? `${adminBase}/food-orders/${order._id}`
      : `${adminBase}/trips/${ride._id}`
    : null;

  await sendTeamAlert(team, {
    sms:
      `QareGO alert: no rider has taken ${what} for ${waited} min. ` +
      `${from} → ${to}. GH₵${fare.toFixed(2)} ${pay}. Customer: ${who}. ` +
      `Riders online: ${onDuty}. Trip ${ref}.`,
    subject: `No rider: ${what} waiting ${waited} min`,
    emailLines: [
      `No rider has taken ${what} for ${waited} minutes.`,
      "",
      `Pickup: ${from}`,
      `Drop-off: ${to}`,
      `Fare: GH₵${fare.toFixed(2)}, ${pay === "MoMo" ? "mobile money" : "cash"}`,
      `Customer: ${customer?.name || "Customer"}, ${normalizePhone(customer?.phone) || "no phone on file"}`,
      `Riders online now: ${onDuty}`,
      `Trip: ${ref}`,
      "",
      order
        ? "Assign a rider from the order page, or call riders near the store."
        : "Assign a rider from the trip page (Trips → Assign), or call the customer.",
    ],
    link,
    pushTitle: "No rider yet",
    data: { type: "admin_no_rider_alert", rideId: String(ride._id), ...(order ? { orderId: String(order._id) } : {}) },
    logTag: `ride ${ride._id}`,
  });
}

/** One pass: alert the team once about each job no rider has taken in time. */
export async function processNoRiderJobs(now = new Date()) {
  const settings = await Settings.findOne({ key: "global" }).select("orderAlerts").lean();
  const config = getOrderAlertConfig(settings);
  const team = { phones: config.phones, emails: await superAdminEmails() };
  // Nobody to tell: leave jobs unclaimed for later.
  if (!team.phones.length && !team.emails.length) return 0;

  const shortest = Math.min(config.rideNoRiderMinutes, config.parcelNoRiderMinutes, config.courierNoRiderMinutes);
  const candidates = await Ride.find({
    status: "SEARCHING_FOR_RIDER",
    noRiderAlertSentAt: null,
    createdAt: { $gte: new Date(now - LOOKBACK_MINUTES * MINUTE), $lt: new Date(now - shortest * MINUTE) },
  })
    .populate("foodOrder", "status timeline updatedAt restaurantName")
    .sort({ createdAt: 1 })
    .limit(30)
    .lean();

  let sent = 0;
  for (const ride of candidates) {
    const order = ride.foodOrder && typeof ride.foodOrder === "object" ? ride.foodOrder : null;
    const wait = noRiderWait(ride, order, config);
    if (!wait || now - wait.since < wait.minutes * MINUTE) continue;
    const claimed = await Ride.updateOne(
      { _id: ride._id, status: "SEARCHING_FOR_RIDER", noRiderAlertSentAt: null },
      { $set: { noRiderAlertSentAt: now } }
    );
    if (!claimed.modifiedCount) continue;
    try {
      await alertNoRider(ride, order, wait, team, now);
      sent += 1;
    } catch (err) {
      console.warn(`[order-alert] no-rider alert failed for ${ride._id}:`, err?.message || err);
    }
  }
  return sent;
}

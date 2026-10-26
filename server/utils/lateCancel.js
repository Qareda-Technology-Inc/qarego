// Late cancels: a customer cancels a ride or parcel after the rider has arrived (or during the
// trip). QareGO pays the rider a fee (Settings.lateCancelFee); the customer isn't charged, but
// late cancels are counted, and too many in a while block ride and parcel bookings for a few days.
import LateCancellation from "../models/LateCancellation.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { BadRequestError } from "../errors/index.js";
import { getSettings } from "./tripSettlement.js";
import { sendPushToUserId } from "./pushNotifications.js";

const DAY_MS = 86_400_000;
const LATE_STAGES = ["ARRIVED", "IN_PROGRESS"];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dayLabel = (d) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export function lateCancelPolicy(settings) {
  return {
    fee: Math.max(0, round2(settings?.lateCancelFee)),
    limit: Math.max(0, Math.floor(Number(settings?.lateCancelLimit) || 0)),
    windowDays: Math.max(1, Math.floor(Number(settings?.lateCancelWindowDays) || 30)),
    blockDays: Math.max(1, Math.floor(Number(settings?.lateCancelBlockDays) || 3)),
  };
}

/** Is cancelling this ride now a late cancel? (Rider there or trip under way; rides and parcels.) */
export const isLateCancel = (ride) =>
  !!ride?.rider && LATE_STAGES.includes(ride.status) && ["RIDE", "DELIVERY"].includes(ride.serviceType);

/**
 * Call when a customer cancels, with the ride as it was just before (before it's deleted).
 * Records the late cancel, pays the rider, and blocks the customer if they're over the limit.
 * Never throws: cancelling must always work.
 */
export async function handleCustomerCancel(ride, io) {
  if (!isLateCancel(ride)) return null;
  try {
    const policy = lateCancelPolicy(await getSettings());
    let record;
    try {
      record = await LateCancellation.create({
        customer: ride.customer,
        rider: ride.rider,
        ride: ride._id,
        serviceType: ride.serviceType,
        stage: ride.status,
        pickup: ride.pickup?.address || null,
      });
    } catch (err) {
      if (err?.code === 11000) return null; // already handled
      throw err;
    }

    const what = ride.serviceType === "DELIVERY" ? "parcel" : "trip";
    if (policy.fee > 0) {
      const updated = await User.findByIdAndUpdate(ride.rider, { $inc: { balance: policy.fee } }, { new: true }).select(
        "balance driverDetails.status"
      );
      const balance = round2(updated?.balance);
      await Transaction.create({
        ride: ride._id,
        driver: ride.rider,
        amount: policy.fee,
        type: "CANCELLATION_CREDIT",
        note: `The customer cancelled the ${what} after you arrived. QareGO paid you for your time.`,
        balanceAfter: balance,
      });
      // Same rule as a top-up: clearing the debt lifts a debt suspension.
      if (updated?.driverDetails?.status === "suspended_debt" && balance >= 0) {
        await User.updateOne({ _id: ride.rider }, { $set: { "driverDetails.status": "active" } });
      }
      await LateCancellation.updateOne({ _id: record._id }, { $set: { riderPaid: policy.fee } });
      io?.to(`rider_${ride.rider}`).emit("walletUpdated", { balance });
      void sendPushToUserId(ride.rider, {
        title: `GH₵${policy.fee.toFixed(2)} added to your wallet`,
        body: `The customer cancelled the ${what} after you arrived. QareGO paid you for your time.`,
        data: { type: "rider_wallet" },
      }).catch(() => {});
    }

    if (policy.limit > 0) {
      const since = new Date(Date.now() - policy.windowDays * DAY_MS);
      const count = await LateCancellation.countDocuments({ customer: ride.customer, createdAt: { $gte: since } });
      if (count >= policy.limit) {
        const until = new Date(Date.now() + policy.blockDays * DAY_MS);
        await User.updateOne({ _id: ride.customer }, { $set: { bookingBlockedUntil: until } });
        void sendPushToUserId(ride.customer, {
          title: "Ride bookings paused",
          body: `You've cancelled ${count} times after the rider arrived. You can book rides and parcels again from ${dayLabel(until)}. Store orders still work.`,
          data: { type: "booking_blocked" },
        }).catch(() => {});
      } else {
        void sendPushToUserId(ride.customer, {
          title: "Cancelled after the rider arrived",
          body: `Please cancel before the rider gets to you. After ${policy.limit} late cancels in ${policy.windowDays} days, ride bookings are paused for ${policy.blockDays} days (${count} of ${policy.limit} so far).`,
          data: { type: "late_cancel" },
        }).catch(() => {});
      }
    }
    return record;
  } catch (err) {
    console.error("[late-cancel] could not handle", String(ride?._id), err?.message || err);
    return null;
  }
}

/** Refuse a ride or parcel booking while the customer is blocked for late cancels. */
export async function assertNotBookingBlocked(customerId) {
  const user = await User.findById(customerId).select("bookingBlockedUntil").lean();
  const until = user?.bookingBlockedUntil ? new Date(user.bookingBlockedUntil) : null;
  if (until && until > new Date()) {
    throw new BadRequestError(
      `Ride and parcel bookings are paused on your account because of repeated cancellations after the rider arrived. You can book again from ${dayLabel(until)}. Store orders still work.`,
      { code: "BOOKING_BLOCKED", until }
    );
  }
}

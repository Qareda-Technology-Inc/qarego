// Mobile-money rides and parcels are paid after the trip. These helpers settle them once paid,
// and cover a customer who never pays: the rider can confirm they were paid in cash, an admin
// can write the trip off, and the customer can't book again until it's cleared.
import Ride from "../models/Ride.js";
import { settleTrip } from "./tripSettlement.js";
import { isPaystackConfigured, refundPaystackTransaction, verifyPaystackTransaction } from "./paystackService.js";
import { sendPushToUserId } from "./pushNotifications.js";
import { BadRequestError } from "../errors/index.js";

/** Payment states of a MoMo trip the customer still owes. */
export const OPEN_RIDE_PAYMENT = ["UNPAID", "PENDING", "FAILED"];

const PAYABLE_SERVICES = ["RIDE", "DELIVERY"];

const paidEnough = (paid, expected) => Number(paid) + 0.005 >= Number(expected);

const tripWord = (ride) => (ride?.serviceType === "DELIVERY" ? "delivery" : "trip");

/** Tell the trip's screens (rider and customer) about a payment change. */
export function emitRidePayment(io, ride) {
  if (!io || !ride) return;
  const payload = typeof ride.toObject === "function" ? ride.toObject() : ride;
  io.to(`ride_${ride._id}`).emit("rideUpdate", payload);
  if (ride.customer) io.to(`customer_${ride.customer._id || ride.customer}`).emit("ridePaymentUpdated", payload);
}

/**
 * Refund a MoMo payment that arrived for a trip already settled another way (the rider took
 * cash). The outcome comes back on Paystack's refund webhook (see orderRefunds.applyRefundOutcome).
 */
async function refundLatePayment(ride) {
  if (!isPaystackConfigured() || !ride.paymentReference) {
    ride.refund = { status: "failed", requestedAt: new Date(), error: "Refund by hand: automatic refunds need Paystack" };
    await ride.save();
    return;
  }
  ride.refund = { status: "requested", requestedAt: new Date(), providerId: null, error: null };
  await ride.save();
  const result = await refundPaystackTransaction(
    ride.paymentReference,
    `Trip ${ride._id} was already paid in cash`
  );
  if (result.success) {
    ride.set("refund.providerId", result.id);
  } else {
    ride.set("refund.status", "failed");
    ride.set("refund.error", result.error || "Refund failed");
    console.warn("[ride-payment] late payment refund failed:", String(ride._id), result.error);
  }
  await ride.save();
}

/**
 * Mark a MoMo ride/parcel as paid and run its settlement. Safe to call more than once.
 * A payment for a trip the rider already settled in cash is refunded instead; one for a trip
 * QareGO wrote off is simply kept.
 */
export async function processRidePaymentSuccess(ride, io) {
  if (!ride || ride.paymentStatus === "PAID" || ride.latePaymentAt) return;
  if (ride.paidInCashAt) {
    ride.latePaymentAt = new Date();
    await ride.save();
    await refundLatePayment(ride);
    return;
  }
  ride.paymentStatus = "PAID";
  await ride.save();
  await settleTrip(ride);
  emitRidePayment(io, ride);
}

/** Ask Paystack about a ride payment and apply the result. */
export async function reconcilePaystackRidePayment(ride, io) {
  if (!ride?.paymentReference || ride.paymentStatus === "PAID" || ride.latePaymentAt) return;
  const result = await verifyPaystackTransaction(ride.paymentReference);
  // Declines aren't final (the checkout allows retries); only a full payment counts.
  if (result.status !== "success") return;
  if (paidEnough(result.amount, ride.fare)) {
    await processRidePaymentSuccess(ride, io);
  } else {
    console.warn("[paystack] ride payment amount mismatch:", ride.paymentReference, result.amount, ride.fare);
  }
}

/** Whether this trip is a completed MoMo trip the customer still owes. */
export function isUnpaidMomoTrip(ride) {
  return (
    !!ride &&
    ride.status === "COMPLETED" &&
    ride.paymentMethod === "MOBILE_MONEY" &&
    PAYABLE_SERVICES.includes(ride.serviceType) &&
    OPEN_RIDE_PAYMENT.includes(ride.paymentStatus)
  );
}

/**
 * The rider (or an admin) confirms the customer paid in cash: the trip becomes a cash trip and
 * settles like one (commission comes off the rider's balance). Checks Paystack first, so a MoMo
 * payment that did go through is used instead.
 * @returns {{ ride, outcome: "cash" | "already_paid" }}
 */
export async function markRidePaidInCash(ride, { by, io }) {
  if (ride.paymentStatus === "PENDING" && ride.paymentReference && isPaystackConfigured()) {
    try {
      await reconcilePaystackRidePayment(ride, io);
    } catch (err) {
      console.warn("[ride-payment] status check before cash failed:", String(ride._id), err.message);
    }
    if (ride.paymentStatus === "PAID") return { ride, outcome: "already_paid" };
  }
  ride.paymentMethod = "CASH";
  ride.paymentStatus = "NOT_REQUIRED";
  ride.paidInCashAt = new Date();
  ride.cashConfirmedBy = by;
  await ride.save();
  await settleTrip(ride);
  emitRidePayment(io, ride);
  if (ride.customer) {
    void sendPushToUserId(ride.customer._id || ride.customer, {
      title: "Payment recorded",
      body: `Your ${tripWord(ride)} was marked as paid in cash. Nothing more to pay.`,
      data: { type: "ride_payment", rideId: String(ride._id) },
    }).catch(() => {});
  }
  return { ride, outcome: "cash" };
}

/**
 * Admin writes off a trip the customer never paid: QareGO pays the rider as if the MoMo payment
 * had arrived (fare in, commission out), and the customer can book again.
 */
export async function writeOffUnpaidRide(ride, { io }) {
  ride.paymentStatus = "WAIVED";
  ride.waivedAt = new Date();
  await ride.save();
  await settleTrip(ride);
  emitRidePayment(io, ride);
  return ride;
}

/**
 * The customer's oldest completed MoMo trip that still isn't paid, or null. A payment stuck on
 * "pending" is checked with Paystack first so a payment that went through isn't held against them.
 */
export async function findUnpaidRide(customerId, io) {
  const rides = await Ride.find({
    customer: customerId,
    status: "COMPLETED",
    paymentMethod: "MOBILE_MONEY",
    serviceType: { $in: PAYABLE_SERVICES },
    paymentStatus: { $in: OPEN_RIDE_PAYMENT },
  })
    .sort({ updatedAt: 1 })
    .limit(5);
  for (const ride of rides) {
    if (ride.paymentStatus === "PENDING" && ride.paymentReference && isPaystackConfigured()) {
      try {
        await reconcilePaystackRidePayment(ride, io);
      } catch {
        /* keep it as unpaid; checked again next time */
      }
    }
    if (isUnpaidMomoTrip(ride)) return ride;
  }
  return null;
}

/** Short description of an unpaid trip for the app (block message, home banner). */
export function unpaidRideSummary(ride) {
  if (!ride) return null;
  return {
    rideId: String(ride._id),
    fare: Number(ride.fare) || 0,
    serviceType: ride.serviceType,
    completedAt: ride.updatedAt,
    pickup: ride.pickup?.address || null,
    drop: ride.drop?.address || null,
  };
}

/**
 * Stop a new booking while the customer owes for a MoMo trip. The error carries the trip so the
 * app can offer "Pay now".
 */
export async function assertNoUnpaidRide(customerId, io) {
  const ride = await findUnpaidRide(customerId, io);
  if (!ride) return;
  const fare = (Number(ride.fare) || 0).toFixed(2);
  throw new BadRequestError(
    `You haven't paid GH₵${fare} for your last ${tripWord(ride)}. Pay it with mobile money to book again.`,
    { code: "UNPAID_RIDE", unpaidRide: unpaidRideSummary(ride) }
  );
}

// Automatic refunds for paid store orders that were cancelled (by the customer, store or
// admin, or a payment that landed after the order was already cancelled).
// Paystack only: with Hubtel the admin still refunds by hand and taps "Mark refunded".
import FoodOrder from "../models/FoodOrder.js";
import Ride from "../models/Ride.js";
import { fetchPaystackRefundStatus, isPaystackConfigured, refundPaystackTransaction } from "./paystackService.js";

/** Start the refund if one is due and hasn't been requested yet. Safe to call repeatedly. */
export async function startRefundIfDue(orderId) {
  if (!isPaystackConfigured()) return null;
  // Claim it first so two callers can't both refund the same order.
  const order = await FoodOrder.findOneAndUpdate(
    {
      _id: orderId,
      refundStatus: "DUE",
      paymentReference: { $ne: null },
      $or: [{ refund: null }, { "refund.status": "failed" }],
    },
    { $set: { refund: { status: "requested", requestedAt: new Date(), providerId: null, error: null } } },
    { new: true }
  );
  if (!order) return null;
  const result = await refundPaystackTransaction(
    order.paymentReference,
    `Order ${order._id} cancelled${order.cancelReason ? `: ${order.cancelReason}` : ""}`
  );
  if (!result.success) {
    await FoodOrder.updateOne(
      { _id: order._id },
      { $set: { "refund.status": "failed", "refund.error": result.error } }
    );
    console.warn("[refund] could not start:", String(order._id), result.error);
    return { started: false, error: result.error };
  }
  await FoodOrder.updateOne({ _id: order._id }, { $set: { "refund.providerId": result.id } });
  return { started: true, id: result.id };
}

/** Paystack's refund webhook: mark the order refunded, or failed so admin can step in. */
export async function applyRefundOutcome(transactionReference, outcome, message) {
  const order = await FoodOrder.findOne({ paymentReference: transactionReference, refundStatus: "DUE" });
  if (!order) {
    // A MoMo payment for a trip that had already been paid in cash (see ridePayments.js).
    const ride = await Ride.findOne({ paymentReference: transactionReference, "refund.status": "requested" });
    if (!ride) return;
    if (outcome === "processed") {
      ride.set("refund.status", "processed");
      ride.paymentStatus = "REFUNDED";
    } else if (outcome === "failed") {
      ride.set("refund.status", "failed");
      ride.set("refund.error", message || "Refund failed");
    }
    await ride.save();
    return;
  }
  if (outcome === "processed") {
    order.refundStatus = "REFUNDED";
    order.refundedAt = new Date();
    order.paymentStatus = "REFUNDED";
    order.refund = { ...(order.refund?.toObject?.() || order.refund || {}), status: "processed", error: null };
  } else if (outcome === "failed") {
    order.refund = { ...(order.refund?.toObject?.() || order.refund || {}), status: "failed", error: message || "Refund failed" };
  }
  await order.save();
}

/** Ask Paystack about a requested refund (in case its webhook didn't arrive). */
export async function refreshRefund(order) {
  if (!isPaystackConfigured() || order?.refundStatus !== "DUE" || order.refund?.status !== "requested" || !order.refund.providerId) return;
  try {
    const state = await fetchPaystackRefundStatus(order.refund.providerId);
    if (state !== "pending") await applyRefundOutcome(order.paymentReference, state, state === "failed" ? "Refund failed at Paystack" : null);
  } catch (err) {
    console.warn("[refund] status check failed:", String(order._id), err.message);
  }
}

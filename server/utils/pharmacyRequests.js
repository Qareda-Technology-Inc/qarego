// Prescription request steps that touch the database and notify people (rules in pharmacyQuote.js).
import FoodOrder from "../models/FoodOrder.js";
import { getSettings } from "./tripSettlement.js";
import { sendPushToUserId } from "./pushNotifications.js";
import { applyRestaurantAction, emitFoodOrderUpdated } from "./foodOrderFlow.js";
import {
  PHARMACY_DECLINED_REASON,
  applyPharmacyDecision,
  applyPharmacyQuote,
  readPharmacyQuote,
} from "./pharmacyQuote.js";

/** Pharmacist sends (or changes) the price. The customer is asked to approve it. */
export async function applyPharmacyQuoteAction(orderId, restaurantId, body, io) {
  const order = await FoodOrder.findOne({ _id: orderId, restaurant: restaurantId });
  if (!order || !order.pharmacyQuote) return { error: "not_found" };
  if (order.status !== "PLACED") return { error: "invalid_transition", message: "This order has moved on" };
  let quote;
  try {
    quote = readPharmacyQuote(body);
    applyPharmacyQuote(order, quote, await getSettings());
  } catch (err) {
    return { error: "bad_quote", message: err.message };
  }
  await order.save();
  const populated = await emitFoodOrderUpdated(io, orderId, { push: false });
  void sendPushToUserId(order.customer, {
    title: "Your prescription is priced",
    body: `${order.restaurantName}: GH₵${order.total.toFixed(2)} with delivery. Tap to approve.`,
    data: { type: "food_order", orderId: String(order._id), status: "PHARMACY_PRICE" },
  }).catch(() => {});
  return { order: populated };
}

/**
 * Customer approves or declines the price. Approving a cash order starts it at once; a mobile
 * money order starts when the payment lands (startPaidPharmacyOrder). Declining cancels it.
 */
export async function applyPharmacyCustomerDecision(orderId, customerId, decision, io) {
  if (!["approve", "decline"].includes(decision)) return { error: "bad_decision" };
  const order = await FoodOrder.findOne({ _id: orderId, customer: customerId });
  if (!order || !order.pharmacyQuote) return { error: "not_found" };
  if (order.status !== "PLACED") return { error: "invalid_transition", message: "This order has moved on" };
  try {
    applyPharmacyDecision(order, decision);
  } catch (err) {
    return { error: "invalid_transition", message: err.message };
  }
  await order.save();

  if (decision === "decline") {
    return applyRestaurantAction(orderId, "customer_cancel", io, { cancelReason: PHARMACY_DECLINED_REASON });
  }
  if (order.paymentMethod !== "MOBILE_MONEY" || order.paymentStatus === "PAID") {
    const started = await applyRestaurantAction(orderId, "accept", io);
    if (!started.error) return started;
  }
  return { order: await emitFoodOrderUpdated(io, orderId, { push: false }) };
}

/** A mobile money payment landed on an approved prescription order: the pharmacy starts on it. */
export async function startPaidPharmacyOrder(orderId, io) {
  const order = await FoodOrder.findById(orderId).select("status paymentStatus pharmacyQuote").lean();
  if (!order?.pharmacyQuote || order.pharmacyQuote.priceStatus !== "approved") return null;
  if (order.status !== "PLACED" || order.paymentStatus !== "PAID") return null;
  return applyRestaurantAction(orderId, "accept", io);
}

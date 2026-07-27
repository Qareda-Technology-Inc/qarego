/**
 * Food order money split and delivery-time settlement.
 * MoMo: Hubtel disburse restaurantNet + riderNet on delivery; platform keeps platformNet.
 * Cash POD: rider balance -= platformNet (ledger only).
 */
import FoodOrder from "../models/FoodOrder.js";
import Restaurant from "../models/Restaurant.js";
import Ride from "../models/Ride.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import {
  detectGhMomoChannel,
  formatPhoneForHubtel,
  sendPayment,
} from "./hubtelService.js";
import { getCommissionRateForService, getSettings } from "./tripSettlement.js";
import { appendWebhookToken } from "../middleware/hubtelWebhookAuth.js";

const DEFAULT_FOOD_DELIVERY_COMMISSION = 0;

function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
}

export function getFoodDeliveryCommissionRate(settings) {
  const raw = Number(settings?.foodDeliveryCommissionRate ?? DEFAULT_FOOD_DELIVERY_COMMISSION);
  if (!Number.isFinite(raw) || raw < 0 || raw > 1) return DEFAULT_FOOD_DELIVERY_COMMISSION;
  return raw;
}

/**
 * Compute frozen split for a food order from admin rates.
 * restaurant commission applies to subtotal; rider commission applies to delivery fee.
 */
export function computeFoodOrderSplit(order, settings) {
  const subtotal = roundMoney(order?.subtotal ?? 0);
  const deliveryFee = roundMoney(order?.deliveryFee ?? 0);
  const serviceFee = roundMoney(order?.serviceFee ?? 0);

  const restaurantCommissionRate = getCommissionRateForService(settings, "FOOD");
  const riderCommissionRate = getFoodDeliveryCommissionRate(settings);

  const restaurantCommission = roundMoney(subtotal * restaurantCommissionRate);
  const restaurantNet = roundMoney(Math.max(0, subtotal - restaurantCommission));
  const riderCommission = roundMoney(deliveryFee * riderCommissionRate);
  const riderNet = roundMoney(Math.max(0, deliveryFee - riderCommission));
  const platformNet = roundMoney(restaurantCommission + serviceFee + riderCommission);

  return {
    restaurantCommissionRate,
    riderCommissionRate,
    restaurantCommission,
    restaurantNet,
    riderCommission,
    riderNet,
    platformNet,
  };
}

function isOrderReadyForSettlement(order) {
  if (!order) return false;
  if (order.fulfillmentType === "PICKUP") {
    return order.status === "READY_FOR_PICKUP" || order.status === "DELIVERED";
  }
  return order.status === "DELIVERED";
}

function makeSettlementRef(prefix, orderId) {
  const tail = String(orderId).slice(-10);
  const stamp = Date.now().toString(36).slice(-4);
  return `${prefix}${tail}${stamp}`.slice(0, 32);
}

function resolvePublicBaseUrl() {
  return (
    process.env.BASE_URL ||
    process.env.PUBLIC_API_URL ||
    process.env.API_BASE_URL ||
    null
  );
}

function getPayoutCallbackUrl() {
  const explicit = process.env.HUBTEL_PAYOUT_CALLBACK_URL;
  const base = resolvePublicBaseUrl();
  const url =
    explicit || (base ? `${String(base).replace(/\/$/, "")}/webhooks/hubtel-payout` : null);
  return appendWebhookToken(url);
}

function resolveRestaurantPayoutTarget(restaurant) {
  const msisdn =
    restaurant?.payoutConfig?.recipientMsisdn ||
    restaurant?.owner?.phone ||
    "";
  const name =
    restaurant?.payoutConfig?.recipientName ||
    restaurant?.owner?.name ||
    restaurant?.name ||
    "Merchant";
  const channel = restaurant?.payoutConfig?.channel || "mtn-gh";
  return { msisdn, name, channel };
}

function legSucceeded(leg, amountDue) {
  if (amountDue <= 0) return true;
  if (!leg) return false;
  // "sent" = Hubtel payout webhook confirmed. "pending" = API accepted, awaiting callback.
  if (leg.status === "sent" || leg.status === "pending") return true;
  return Boolean(leg.success);
}

function legNeedsDisbursement(leg, amountDue) {
  if (amountDue <= 0) return false;
  if (!leg) return true;
  // Do not re-send while Hubtel is in-flight or already confirmed.
  if (leg.status === "sent" || leg.status === "pending") return false;
  return true;
}

async function disburseToRecipient({
  amount,
  name,
  msisdn,
  channel,
  description,
  clientReference,
}) {
  if (amount <= 0) {
    return { success: true, skipped: true, amount: 0 };
  }
  const phone = formatPhoneForHubtel(msisdn);
  if (!phone) {
    return {
      success: false,
      skipped: false,
      amount,
      error: "Missing payout phone — set restaurant payout MoMo or owner phone",
    };
  }

  const payout = await sendPayment({
    RecipientName: name || "Recipient",
    RecipientMsisdn: phone,
    Amount: amount,
    PrimaryCallbackUrl: getPayoutCallbackUrl() || undefined,
    Description: description,
    ClientReference: clientReference,
    Channel: channel || "mtn-gh",
  });

  if (!payout.success) {
    console.error("[food-settlement] Hubtel send failed:", {
      clientReference,
      amount,
      error: payout.error,
      response: payout.data,
    });
  }

  return {
    success: payout.success,
    skipped: false,
    amount,
    reference: clientReference,
    response: payout.data || null,
    error: payout.error || null,
  };
}

async function applyCashSettlement(order, ride, settings) {
  const platformNet = roundMoney(order.platformNet ?? 0);
  if (platformNet <= 0) {
    return { success: true, method: "cash", note: "No platform share due" };
  }

  const riderId = ride?.rider?._id || ride?.rider;
  if (!riderId) {
    return {
      success: true,
      method: "cash_pickup",
      note: "Pickup cash — restaurant settles platform share offline",
    };
  }

  const rideId = ride?._id || order.ride;
  const existing = await Transaction.findOne({
    ride: rideId,
    driver: riderId,
    type: "COMMISSION_DEBIT",
  });
  if (existing) {
    return { success: true, method: "cash", note: "Already debited" };
  }

  const driver = await User.findById(riderId);
  if (!driver) {
    return { success: false, method: "cash", error: "Rider not found" };
  }

  const debtLimit = settings.debtLimit ?? -100;
  let balance = Number(driver.balance ?? 0);
  balance -= platformNet;

  await Transaction.create({
    ride: rideId,
    driver: riderId,
    amount: -platformNet,
    type: "COMMISSION_DEBIT",
    note: `Food cash delivery — platform share (${platformNet.toFixed(2)} GHS)`,
    balanceAfter: balance,
  });

  await User.findByIdAndUpdate(riderId, { balance });

  if (balance < debtLimit) {
    await User.findByIdAndUpdate(riderId, { "driverDetails.status": "suspended_debt" });
  }

  return { success: true, method: "cash", amount: platformNet, balanceAfter: balance };
}

async function applyMomoSettlement(order, restaurant, ride) {
  if (order.paymentStatus !== "PAID") {
    return {
      success: false,
      method: "momo",
      error: "Order not paid — cannot disburse",
    };
  }

  const restaurantNet = roundMoney(order.restaurantNet ?? 0);
  const riderNet = roundMoney(order.riderNet ?? 0);
  const details = order.settlementDetails || {};

  const results = { restaurant: null, rider: null };

  if (restaurantNet > 0 && legNeedsDisbursement(details.restaurant, restaurantNet)) {
    const { msisdn, name, channel } = resolveRestaurantPayoutTarget(restaurant);
    const ref =
      details.restaurant?.reference ||
      makeSettlementRef("fosr_", order._id);

    results.restaurant = await disburseToRecipient({
      amount: restaurantNet,
      name,
      msisdn,
      channel,
      description: `QareGO food payout ${order._id}`,
      clientReference: ref,
    });
  } else if (restaurantNet <= 0) {
    results.restaurant = { success: true, skipped: true, amount: 0 };
  } else {
    results.restaurant = details.restaurant;
  }

  const riderId = ride?.rider?._id || ride?.rider;
  if (riderNet > 0 && riderId && legNeedsDisbursement(details.rider, riderNet)) {
    const rider = ride?.rider?.phone
      ? ride.rider
      : await User.findById(riderId).select("name phone").lean();
    const msisdn = rider?.phone || "";
    const ref =
      details.rider?.reference || makeSettlementRef("fosd_", order._id);

    results.rider = await disburseToRecipient({
      amount: riderNet,
      name: rider?.name || "Rider",
      msisdn,
      channel: detectGhMomoChannel(msisdn),
      description: `QareGO food delivery fee ${order._id}`,
      clientReference: ref,
    });
  } else if (riderNet <= 0) {
    results.rider = { success: true, skipped: true, amount: 0 };
  } else {
    results.rider = details.rider;
  }

  const restaurantOk = legSucceeded(results.restaurant, restaurantNet);
  const riderOk = legSucceeded(results.rider, riderNet);

  const allOk = restaurantOk && riderOk;
  const anyAttempted =
    (results.restaurant && !results.restaurant.skipped) ||
    (results.rider && !results.rider.skipped);

  return {
    success: allOk,
    method: "momo",
    results,
    anyAttempted,
  };
}

function buildSettlementDetails(momoResult) {
  const details = {};
  const r = momoResult?.results?.restaurant;
  if (r) {
    details.restaurant = {
      amount: r.amount ?? 0,
      reference: r.reference || null,
      // API accept → pending until /webhooks/hubtel-payout confirms "sent".
      status: r.skipped ? "not_applicable" : r.success ? "pending" : "failed",
      error: r.error || null,
      response: r.response || null,
    };
  }
  const d = momoResult?.results?.rider;
  if (d) {
    details.rider = {
      amount: d.amount ?? 0,
      reference: d.reference || null,
      status: d.skipped ? "not_applicable" : d.success ? "pending" : "failed",
      error: d.error || null,
      response: d.response || null,
    };
  }
  return details;
}

/**
 * Idempotent settlement when a food order is fulfilled (DELIVERED or pickup ready).
 */
export async function settleFoodOrderOnDelivery(orderId) {
  // Atomically claim the order so concurrent callers (delivery + payment webhook + admin)
  // cannot double-disburse.
  const claimed = await FoodOrder.findOneAndUpdate(
    {
      _id: orderId,
      settlementStatus: { $in: ["pending", "failed"] },
    },
    { $set: { settlementStatus: "processing", settlementError: null } },
    { new: true }
  );

  if (!claimed) {
    const existing = await FoodOrder.findById(orderId).select("settlementStatus status").lean();
    if (!existing) return { skipped: true, reason: "not_found" };
    if (existing.settlementStatus === "settled") {
      return { skipped: true, reason: "already_settled" };
    }
    if (existing.settlementStatus === "processing") {
      return { skipped: true, reason: "in_flight" };
    }
    return { skipped: true, reason: "not_claimable", status: existing.settlementStatus };
  }

  const order = claimed;

  if (!isOrderReadyForSettlement(order)) {
    order.settlementStatus = "pending";
    await order.save();
    return { skipped: true, reason: "not_ready", status: order.status };
  }

  const settings = await getSettings();
  const split = computeFoodOrderSplit(order, settings);

  if (order.restaurantNet == null) {
    Object.assign(order, split);
    await order.save();
  }

  let ride = null;
  if (order.ride) {
    ride = await Ride.findById(order.ride).populate("rider", "name phone balance");
  }

  const restaurant = await Restaurant.findById(order.restaurant)
    .populate("owner", "name phone")
    .lean();

  let outcome;
  if (order.paymentMethod === "MOBILE_MONEY") {
    outcome = await applyMomoSettlement(order, restaurant, ride);
    const details = {
      ...(order.settlementDetails || {}),
      ...buildSettlementDetails(outcome),
    };
    order.settlementDetails = details;
    order.settlementMethod = "momo";

    const restaurantOk =
      !details.restaurant ||
      ["sent", "not_applicable", "pending"].includes(details.restaurant.status);
    const riderOk =
      !details.rider ||
      ["sent", "not_applicable", "pending"].includes(details.rider.status);
    const anyFailed =
      details.restaurant?.status === "failed" || details.rider?.status === "failed";
    const anyPending =
      details.restaurant?.status === "pending" || details.rider?.status === "pending";
    const allConfirmed =
      (!details.restaurant || ["sent", "not_applicable"].includes(details.restaurant.status)) &&
      (!details.rider || ["sent", "not_applicable"].includes(details.rider.status));

    if (allConfirmed && !anyFailed) {
      // Both legs already confirmed (e.g. zero amounts / prior webhook).
      order.settlementStatus = "settled";
      order.settledAt = new Date();
      order.settlementError = null;
    } else if (anyFailed) {
      order.settlementStatus = "failed";
      order.settlementError =
        outcome.error ||
        details.restaurant?.error ||
        details.rider?.error ||
        "Disbursement failed";
    } else if (anyPending && restaurantOk && riderOk) {
      // Hubtel accepted — wait for payout webhook before marking settled.
      order.settlementStatus = "processing";
      order.settlementError = null;
    } else {
      order.settlementStatus = "pending";
      order.settlementError = outcome.error || "Payment required before disbursement";
    }
  } else {
    outcome = await applyCashSettlement(order, ride, settings);
    order.settlementMethod = outcome.method || "cash";
    if (outcome.success) {
      order.settlementStatus = "settled";
      order.settledAt = new Date();
      order.settlementError = null;
      order.settlementDetails = {
        ...(order.settlementDetails || {}),
        cash: outcome,
      };
    } else {
      order.settlementStatus = "failed";
      order.settlementError = outcome.error || "Cash settlement failed";
    }
  }

  await order.save();

  if (order.settlementStatus === "failed" || order.settlementError) {
    console.error("[food-settlement] order", order._id, {
      status: order.settlementStatus,
      error: order.settlementError,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      restaurantNet: order.restaurantNet,
      riderNet: order.riderNet,
      details: order.settlementDetails,
    });
  }

  return {
    orderId: order._id,
    settlementStatus: order.settlementStatus,
    settlementError: order.settlementError,
    outcome,
  };
}

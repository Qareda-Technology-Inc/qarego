/**
 * Food order money split and delivery-time settlement.
 * MoMo: send restaurantNet + riderNet by MoMo on delivery; platform keeps platformNet. If the
 * rider's transfer fails, their pay goes to their wallet instead (leg status "wallet").
 * Cash POD: rider balance -= platformNet (ledger only).
 */
import { sendMomoPayout } from "./momoPayout.js";
import { sendPushToUserId } from "./pushNotifications.js";
import { fetchPaystackTransferStatus, isPaystackConfigured } from "./paystackService.js";
import { getGasConfig } from "./gasOrders.js";
import StoreLedgerEntry from "../models/StoreLedgerEntry.js";
import FoodOrder from "../models/FoodOrder.js";
import Restaurant from "../models/Restaurant.js";
import Ride from "../models/Ride.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import {
  detectGhMomoChannel,
  formatPhoneForHubtel,
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
 * Cash breakdown for a FOOD cash order's courier, from the split frozen on the order at
 * checkout (the same values cash settlement debits). Null for MoMo or unsplit orders.
 */
export function buildCourierCashCollection(order) {
  if (order?.paymentMethod !== "CASH") return null;
  if (order.restaurantNet == null || order.riderNet == null || order.platformNet == null) {
    return null;
  }
  return {
    collectFromCustomer: roundMoney(order.total ?? 0),
    payStore: roundMoney(order.restaurantNet),
    riderKeeps: roundMoney(order.riderNet),
    platformShare: roundMoney(order.platformNet),
  };
}

/**
 * Compute frozen split for a food order from admin rates.
 * restaurant commission applies to subtotal; rider commission applies to delivery fee.
 */
export function computeFoodOrderSplit(order, settings, options = {}) {
  const subtotal = roundMoney(order?.subtotal ?? 0);
  const deliveryFee = roundMoney(order?.deliveryFee ?? 0);
  const serviceFee = roundMoney(order?.serviceFee ?? 0);

  // Gas stations pay their own (owner-set) commission on the gas cost.
  const restaurantCommissionRate =
    options.stationCommissionRate != null
      ? Number(options.stationCommissionRate)
      : getCommissionRateForService(settings, "FOOD");
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
  // Pickup orders settle when the customer actually collects (marked by the store).
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
  // Infer network from MSISDN so a wrong admin default (mtn-gh) can't misroute Vodafone/Airtel.
  const channel = msisdn
    ? detectGhMomoChannel(msisdn)
    : restaurant?.payoutConfig?.channel || "mtn-gh";
  return { msisdn, name, channel };
}

/** Leg states that need nothing more: paid, nothing due, or (rider only) put in their wallet. */
export const SETTLED_LEG_STATUSES = ["sent", "not_applicable", "wallet"];

function legSucceeded(leg, amountDue) {
  if (amountDue <= 0) return true;
  if (!leg) return false;
  // "sent" = payout confirmed. "pending" = accepted, awaiting the webhook.
  if (["sent", "pending", "wallet"].includes(leg.status)) return true;
  return Boolean(leg.success);
}

function legNeedsDisbursement(leg, amountDue) {
  if (amountDue <= 0) return false;
  if (!leg) return true;
  // Do not re-send while a transfer is in flight, confirmed, or already paid to the wallet.
  if (["sent", "pending", "wallet"].includes(leg.status)) return false;
  return true;
}

/**
 * Order settlement status from its two MoMo legs: settled once both are done, failed if either
 * failed, processing while a transfer awaits its webhook. Null when no leg has been sent yet.
 */
export function settlementStatusFor(details) {
  const legs = [details?.restaurant, details?.rider].filter(Boolean);
  if (!legs.length) return null;
  const failed = legs.find((l) => l.status === "failed");
  if (failed) return { status: "failed", error: failed.error || "Payout failed" };
  if (legs.every((l) => SETTLED_LEG_STATUSES.includes(l.status))) return { status: "settled", error: null };
  if (legs.every((l) => SETTLED_LEG_STATUSES.includes(l.status) || l.status === "pending")) {
    return { status: "processing", error: null };
  }
  return null;
}

const orderNo = (order) => String(order._id).slice(-8).toUpperCase();

/**
 * The rider's pay on a MoMo order goes straight to their MoMo and never touches their wallet.
 * Show it in their history (a DIRECT_PAYOUT line, no balance change). If the transfer failed,
 * put the money in their wallet instead so it can't get stuck. Updates details.rider in place.
 * Safe to call more than once: the unique indexes on Transaction stop a second line or credit.
 */
export async function syncRiderDeliveryPay(order, details) {
  const leg = details?.rider;
  const amount = roundMoney(leg?.amount ?? 0);
  if (!leg || amount <= 0 || !["pending", "sent", "failed"].includes(leg.status)) return;
  const ride = order.ride ? await Ride.findById(order.ride._id || order.ride).select("rider").lean() : null;
  const riderId = ride?.rider;
  if (!riderId) return;

  if (leg.status === "failed") {
    const reference = `wallet_${order._id}`;
    try {
      await Transaction.create({
        ride: ride._id,
        driver: riderId,
        amount,
        type: "DELIVERY_PAY",
        note: `Delivery pay for order #${orderNo(order)}. The MoMo transfer didn't go through, so it was added to your wallet.`,
        reference,
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      // Already credited by an earlier call.
      details.rider = { ...leg, status: "wallet", walletReference: reference };
      return;
    }
    const updated = await User.findByIdAndUpdate(riderId, { $inc: { balance: amount } }, { new: true }).select(
      "balance driverDetails.status"
    );
    const balance = roundMoney(updated?.balance ?? amount);
    await Transaction.updateOne({ reference, type: "DELIVERY_PAY" }, { $set: { balanceAfter: balance } });
    // Same rule as a top-up: clearing the debt lifts a debt suspension.
    if (updated?.driverDetails?.status === "suspended_debt" && balance >= 0) {
      await User.updateOne({ _id: riderId }, { $set: { "driverDetails.status": "active" } });
    }
    // A "sent to your MoMo" line from before the transfer failed would now be wrong.
    await Transaction.deleteMany({ ride: ride._id, type: "DIRECT_PAYOUT" });
    details.rider = { ...leg, status: "wallet", walletReference: reference, walletCreditedAt: new Date() };
    void sendPushToUserId(riderId, {
      title: `GH₵${amount.toFixed(2)} added to your wallet`,
      body: `Your delivery pay for order #${orderNo(order)} couldn't be sent to your MoMo, so it's in your QareGO wallet. Cash out any time.`,
      data: { type: "rider_wallet" },
    }).catch(() => {});
    return;
  }

  try {
    const user = await User.findById(riderId).select("balance").lean();
    await Transaction.create({
      ride: ride._id,
      driver: riderId,
      amount,
      type: "DIRECT_PAYOUT",
      note: `Delivery pay for order #${orderNo(order)}, sent to your MoMo`,
      reference: leg.reference,
      balanceAfter: roundMoney(user?.balance ?? 0),
    });
  } catch (err) {
    if (err?.code === 11000) return; // already recorded
    throw err;
  }
  void sendPushToUserId(riderId, {
    title: `GH₵${amount.toFixed(2)} sent to your MoMo`,
    body: `Your delivery pay for order #${orderNo(order)} is on its way to your mobile money.`,
    data: { type: "rider_wallet" },
  }).catch(() => {});
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

  const payout = await sendMomoPayout({
    name,
    phone,
    amount,
    reference: clientReference,
    reason: description,
    callbackUrl: getPayoutCallbackUrl() || undefined,
  });

  if (!payout.success) {
    console.error("[food-settlement] payout failed:", {
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

async function recordStorePickupCommission(order, platformNet) {
  try {
    const store = await Restaurant.findByIdAndUpdate(
      order.restaurant,
      { $inc: { commissionOwed: platformNet } },
      { new: true }
    );
    await StoreLedgerEntry.create({
      restaurant: order.restaurant,
      foodOrder: order._id,
      type: "PICKUP_COMMISSION",
      amount: platformNet,
      owedAfter: roundMoney(store?.commissionOwed ?? platformNet),
      note: `QareGO share of pickup order #${String(order._id).slice(-8).toUpperCase()}`,
    });
  } catch (err) {
    if (err?.code === 11000) {
      // Already recorded; undo the duplicate increment.
      await Restaurant.updateOne({ _id: order.restaurant }, { $inc: { commissionOwed: -platformNet } });
      return { success: true, method: "cash_pickup", note: "Already recorded" };
    }
    throw err;
  }
  return { success: true, method: "cash_pickup", note: "Store owes QareGO its share" };
}

async function applyCashSettlement(order, ride, settings) {
  const platformNet = roundMoney(order.platformNet ?? 0);
  if (platformNet <= 0) {
    return { success: true, method: "cash", note: "No platform share due" };
  }

  const riderId = ride?.rider?._id || ride?.rider;
  if (!riderId) {
    // Customer paid the store at the counter: the store now owes QareGO its share.
    return recordStorePickupCommission(order, platformNet);
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

/**
 * Laundry is collected by one rider and often returned by another (it can take a day). The
 * returning rider is settled for the whole delivery fee, so move half of the rider's share to
 * whoever collected the bag. Once per order.
 */
async function shareCollectFirstPay(order, returnRide, settings) {
  if (!order.laundry || !order.collectionRide) return;
  const collection = await Ride.findById(order.collectionRide).select("rider status");
  const collectorId = collection?.rider ? String(collection.rider) : null;
  const returnerId = returnRide?.rider?._id ? String(returnRide.rider._id) : returnRide?.rider ? String(returnRide.rider) : null;
  if (!collectorId || !returnerId || collectorId === returnerId || collection.status !== "COMPLETED") return;

  const amount = roundMoney((order.riderNet ?? 0) / 2);
  if (amount <= 0) return;
  if (await Transaction.exists({ ride: collection._id, type: "TRIP_SHARE_CREDIT" })) return;

  const [collector, returner] = await Promise.all([
    User.findById(collectorId).select("balance driverDetails.status"),
    User.findById(returnerId).select("balance driverDetails.status"),
  ]);
  if (!collector || !returner) return;

  const collectorBalance = roundMoney(Number(collector.balance ?? 0) + amount);
  const returnerBalance = roundMoney(Number(returner.balance ?? 0) - amount);
  await Transaction.create([
    {
      ride: collection._id,
      driver: collector._id,
      amount,
      type: "TRIP_SHARE_CREDIT",
      note: "Laundry collection: your half of the delivery pay",
      balanceAfter: collectorBalance,
    },
    {
      ride: returnRide._id || order.ride,
      driver: returner._id,
      amount: -amount,
      type: "TRIP_SHARE_DEBIT",
      note: "Laundry return: half of the delivery pay goes to the rider who collected it",
      balanceAfter: returnerBalance,
    },
  ]);

  const collectorUpdate = { balance: collectorBalance };
  // Same rule as a top-up: clearing the debt lifts a debt suspension.
  if (collector.driverDetails?.status === "suspended_debt" && collectorBalance >= 0) {
    collectorUpdate["driverDetails.status"] = "active";
  }
  const returnerUpdate = { balance: returnerBalance };
  if (returnerBalance < (settings?.debtLimit ?? -100)) returnerUpdate["driverDetails.status"] = "suspended_debt";
  await Promise.all([
    User.updateOne({ _id: collector._id }, { $set: collectorUpdate }),
    User.updateOne({ _id: returner._id }, { $set: returnerUpdate }),
  ]);
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
    // A failed leg gets a fresh reference: Paystack won't reuse one.
    const ref =
      (details.restaurant?.status !== "failed" && details.restaurant?.reference) ||
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
      (details.rider?.status !== "failed" && details.rider?.reference) ||
      makeSettlementRef("fosd_", order._id);

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
  // A leg that wasn't re-sent comes back as the stored leg (it has a status): keep it as is.
  if (r?.status) {
    details.restaurant = r;
  } else if (r) {
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
  if (d?.status) {
    details.rider = d;
  } else if (d) {
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
  const split = computeFoodOrderSplit(
    order,
    settings,
    order.gasMode ? { stationCommissionRate: getGasConfig(settings).stationCommissionRate } : {}
  );

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
    try {
      await syncRiderDeliveryPay(order, details);
    } catch (err) {
      console.error("[food-settlement] rider pay record failed for order", order._id, err);
    }
    order.settlementDetails = details;
    order.settlementMethod = "momo";

    const next = settlementStatusFor(details);
    if (next) {
      order.settlementStatus = next.status;
      order.settlementError = next.error;
      if (next.status === "settled") order.settledAt = order.settledAt || new Date();
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

  if (["settled", "processing"].includes(order.settlementStatus)) {
    try {
      await shareCollectFirstPay(order, ride, settings);
    } catch (err) {
      console.error("[food-settlement] trip share failed for order", order._id, err);
    }
  }

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

/**
 * Admin retry of a MoMo order's payouts. A failed leg is sent again; a leg stuck on "pending"
 * (no webhook came back) is sent again with a new reference.
 * @returns {{ order, message }}
 */
export async function retryFoodOrderSettlement(orderId) {
  const order = await FoodOrder.findById(orderId);
  if (!order) return { order: null, message: "Order not found" };
  if (order.paymentMethod !== "MOBILE_MONEY" || order.paymentStatus !== "PAID") {
    return { order: order.toObject(), message: "Only paid MoMo orders have payouts to retry" };
  }
  if (order.settlementStatus === "settled") {
    return { order: order.toObject(), message: "Already paid out" };
  }
  if (["failed", "processing"].includes(order.settlementStatus)) {
    const details = { ...(order.settlementDetails || {}) };
    for (const field of ["restaurant", "rider"]) {
      const leg = details[field];
      if (leg?.status !== "pending") continue;
      if (isPaystackConfigured() && leg.reference) {
        // Ask Paystack first so a transfer that did go through isn't sent twice.
        const { status } = await fetchPaystackTransferStatus(leg.reference);
        if (status === "success") details[field] = { ...leg, status: "sent", error: null };
        else if (status === "failed") details[field] = { ...leg, status: "failed", error: "Transfer failed at Paystack" };
        continue; // still pending: leave it alone
      }
      details[field] = {
        ...leg,
        status: "failed",
        error: "Retry: previous payout unconfirmed",
        reference: null,
      };
    }
    order.settlementDetails = details;
    order.settlementStatus = "pending";
    order.settlementError = null;
    await order.save();
  }

  await settleFoodOrderOnDelivery(order._id);
  const fresh = await FoodOrder.findById(order._id).lean();
  const message =
    fresh?.settlementStatus === "settled"
      ? "Payouts completed"
      : fresh?.settlementStatus === "failed"
        ? `Payout failed: ${fresh.settlementError || "check the store's MoMo number and the Paystack balance"}`
        : fresh?.settlementStatus === "processing"
          ? "Sent. Waiting for Paystack to confirm."
          : "Not ready yet. The order may not be delivered.";
  return { order: fresh, message };
}

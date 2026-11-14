// Store orders nobody has accepted. The store is told when the order comes in, but if its
// screen is closed and the SMS or push is missed, the order would sit at "Placed" with nobody
// knowing. After a few minutes the store gets a reminder; a little later QareGO's team gets an
// SMS with the store's and customer's numbers so someone can call. Runs on the food scheduler.
import FoodOrder from "../models/FoodOrder.js";
import Settings from "../models/Settings.js";
import User from "../models/User.js";
import { normalizePhone } from "./phone.js";
import { sendSMS } from "./smsService.js";
import { sendPushToUserId } from "./pushNotifications.js";
import { isFirebaseConfigured } from "./firebaseAdmin.js";
import { resolveRestaurantStaff, notifyStaffMember } from "./vendorOrderNotifications.js";
import { getCommerceOrderCopy, resolveOrderVertical } from "./commerceOrderCopy.js";
import { adminOrigins, merchantPortalBase } from "./portalOrigins.js";
import { sendEmail } from "./emailService.js";

const MINUTE = 60_000;
/** Older orders are left alone, so turning this on doesn't text about last week's orders. */
const LOOKBACK_MINUTES = 120;

export const DEFAULT_ORDER_ALERTS = {
  storeReminderMinutes: 3,
  teamAlertMinutes: 5,
  /** No rider has taken it (utils/noRiderAlerts.js): ride, parcel, store delivery ready to go. */
  rideNoRiderMinutes: 3,
  parcelNoRiderMinutes: 2,
  courierNoRiderMinutes: 5,
  phones: [],
};

const NO_RIDER_KEYS = ["rideNoRiderMinutes", "parcelNoRiderMinutes", "courierNoRiderMinutes"];
const noRiderMinutes = (raw) =>
  Object.fromEntries(NO_RIDER_KEYS.map((k) => [k, clampMinutes(raw?.[k], DEFAULT_ORDER_ALERTS[k])]));

function clampMinutes(value, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(60, Math.max(1, n));
}

export function getOrderAlertConfig(settings) {
  const raw = settings?.orderAlerts || {};
  return {
    storeReminderMinutes: clampMinutes(raw.storeReminderMinutes, DEFAULT_ORDER_ALERTS.storeReminderMinutes),
    teamAlertMinutes: clampMinutes(raw.teamAlertMinutes, DEFAULT_ORDER_ALERTS.teamAlertMinutes),
    ...noRiderMinutes(raw),
    phones: Array.isArray(raw.phones) ? raw.phones.filter(Boolean) : [],
  };
}

/** Admin form → stored config. Throws with a readable message on bad input. */
export function normalizeOrderAlertsInput(input) {
  const phones = [];
  for (const raw of Array.isArray(input?.phones) ? input.phones : []) {
    const text = String(raw || "").trim();
    if (!text) continue;
    const phone = normalizePhone(text);
    if (!/^\+\d{9,15}$/.test(phone)) throw new Error(`"${text}" isn't a phone number`);
    if (!phones.includes(phone)) phones.push(phone);
  }
  if (phones.length > 5) throw new Error("Add at most 5 team phone numbers");
  const config = {
    storeReminderMinutes: clampMinutes(input?.storeReminderMinutes, DEFAULT_ORDER_ALERTS.storeReminderMinutes),
    teamAlertMinutes: clampMinutes(input?.teamAlertMinutes, DEFAULT_ORDER_ALERTS.teamAlertMinutes),
    ...noRiderMinutes(input),
    phones,
  };
  if (config.teamAlertMinutes < config.storeReminderMinutes) {
    throw new Error("Alert the team after the store reminder, not before");
  }
  return config;
}

/** Orders the store could accept now: cash, or mobile money already paid. */
function waitingFilter(olderThan, sinceFloor, sentField) {
  return {
    status: "PLACED",
    // A prescription still to be priced needs the pharmacy (whatever the payment); one waiting
    // for the customer's answer doesn't.
    $or: [
      { paymentMethod: "CASH", "pharmacyQuote.priceStatus": { $ne: "awaiting_customer" } },
      { paymentStatus: "PAID" },
      { "pharmacyQuote.priceStatus": "awaiting_pharmacy" },
    ],
    createdAt: { $lt: olderThan, $gte: sinceFloor },
    [sentField]: null,
  };
}

function minutesWaiting(order, now) {
  return Math.max(1, Math.round((now - new Date(order.createdAt)) / MINUTE));
}

function itemSummary(order) {
  if (order?.pharmacyQuote?.priceStatus === "awaiting_pharmacy") return "a prescription to price";
  const items = Array.isArray(order?.items) ? order.items : [];
  const text = items
    .slice(0, 2)
    .map((i) => `${i.quantity || 1}x ${i.name || "item"}`)
    .join(", ");
  return items.length > 2 ? `${text}…` : text || "an order";
}

async function remindStore(order, now) {
  const { restaurant, staff } = await resolveRestaurantStaff(order.restaurant);
  if (!staff.length) return;
  const name = restaurant?.name || order.restaurantName || "your store";
  const copy = getCommerceOrderCopy(resolveOrderVertical(order, restaurant));
  const base = merchantPortalBase() || "";
  const waited = minutesWaiting(order, now);
  const smsMessage =
    `QareGO: An order at ${name} has been waiting ${waited} min (${itemSummary(order)}). ` +
    `Please accept it now or the customer may cancel.${base ? ` ${copy.smsOpenOrders}: ${base}/orders` : ""}`;
  const pushPayload = {
    title: "Order still waiting",
    body: `${itemSummary(order)} · waiting ${waited} min. Please accept it now.`,
    data: {
      type: "food_new_order",
      orderId: String(order._id),
      restaurantId: String(order.restaurant),
      status: "PLACED",
    },
  };
  for (const user of staff) {
    await notifyStaffMember(user, { pushPayload, smsMessage: smsMessage.slice(0, 320) });
  }
}

/** Super admins (and admins from before roles existed) with an email on their account. */
export async function superAdminEmails() {
  const admins = await User.find({
    role: "admin",
    adminRole: { $in: ["super", null] },
    isSuspended: { $ne: true },
    email: { $nin: [null, ""] },
  })
    .select("email")
    .lean();
  return [...new Set(admins.map((a) => String(a.email).trim().toLowerCase()).filter(Boolean))];
}

async function alertTeam(order, { phones, emails }, now) {
  const { restaurant, staff } = await resolveRestaurantStaff(order.restaurant);
  const customer = order.customer
    ? await User.findById(order.customer).select("name phone").lean()
    : null;
  const name = restaurant?.name || order.restaurantName || "A store";
  const storePhone = staff.map((u) => normalizePhone(u.phone)).find(Boolean);
  const message = (
    `QareGO alert: ${name} hasn't accepted an order for ${minutesWaiting(order, now)} min. ` +
    `${itemSummary(order)}, GH₵${Number(order.total || 0).toFixed(2)}, ${order.paymentMethod === "CASH" ? "cash" : "paid MoMo"}. ` +
    `Store: ${storePhone || "no phone on file"}. ` +
    `Customer: ${customer?.name || "Customer"} ${normalizePhone(customer?.phone) || ""}. ` +
    `Order ${String(order._id).slice(-6)}.`
  ).slice(0, 320);

  const adminBase = adminOrigins()[0];
  await sendTeamAlert(
    { phones, emails },
    {
      sms: message,
      subject: `Order not accepted: ${name} (${minutesWaiting(order, now)} min)`,
      emailLines: [
        `${name} hasn't accepted an order for ${minutesWaiting(order, now)} minutes.`,
        "",
        `Order: ${String(order._id).slice(-6)} (${itemSummary(order)})`,
        `Total: GH₵${Number(order.total || 0).toFixed(2)}, ${order.paymentMethod === "CASH" ? "cash" : "paid by mobile money"}`,
        `Store: ${name}, ${storePhone || "no phone on file"}`,
        `Customer: ${customer?.name || "Customer"}, ${normalizePhone(customer?.phone) || "no phone on file"}`,
        "",
        "Please call the store, or the customer if the store can't take it.",
      ],
      link: adminBase ? `${adminBase.replace(/\/$/, "")}/food-orders/${order._id}` : null,
      pushTitle: "Order not accepted",
      data: { type: "admin_order_alert", orderId: String(order._id) },
      logTag: `order ${order._id}`,
    }
  );
}

/**
 * Tell QareGO's team: SMS to the Settings phones, email to super admins, push to admins with the
 * app. Used for orders a store hasn't accepted and for jobs no rider has taken (noRiderAlerts.js).
 */
export async function sendTeamAlert({ phones, emails }, { sms, subject, emailLines, link, pushTitle, data, logTag }) {
  const message = String(sms).slice(0, 320);
  if (emails.length) {
    const result = await sendEmail({
      to: emails,
      subject,
      text: [...emailLines, ...(link ? ["", `Open it: ${link}`] : [])].join("\n"),
    });
    if (result.success) console.log(`[order-alert] email → ${emails.join(", ")} for ${logTag}`);
  }

  for (const phone of phones) {
    try {
      const result = await sendSMS(phone, message);
      if (result?.success) console.log(`[order-alert] team sms → ${phone} for ${logTag}`);
      else console.warn(`[order-alert] team sms failed → ${phone}`, result?.error || result);
    } catch (err) {
      console.warn(`[order-alert] team sms failed → ${phone}:`, err?.message || err);
    }
  }

  // Admins who use the app (e.g. the owner's phone) also get a push.
  if (isFirebaseConfigured()) {
    const admins = await User.find({ role: "admin", "pushTokens.0": { $exists: true } }).select("_id").lean();
    for (const admin of admins) {
      void sendPushToUserId(admin._id, {
        title: pushTitle,
        body: message.replace(/^QareGO alert: /, ""),
        data,
      }).catch(() => {});
    }
  }
}

/**
 * One pass: remind stores and alert the team about orders waiting too long. Each order gets
 * each message once (claimed by setting the *SentAt field first).
 */
export async function processWaitingOrders(io, now = new Date()) {
  const settings = await Settings.findOne({ key: "global" }).select("orderAlerts").lean();
  const config = getOrderAlertConfig(settings);
  const floor = new Date(now - LOOKBACK_MINUTES * MINUTE);

  const emails = await superAdminEmails();
  const team = { phones: config.phones, emails };
  const steps = [
    {
      field: "storeReminderSentAt",
      after: config.storeReminderMinutes,
      run: (order) => remindStore(order, now),
    },
    {
      field: "teamAlertSentAt",
      after: config.teamAlertMinutes,
      // With no team numbers or super admin emails there is nobody to tell; leave the order
      // unclaimed for later.
      run: team.phones.length || team.emails.length ? (order) => alertTeam(order, team, now) : null,
    },
  ];

  let sent = 0;
  for (const step of steps) {
    if (!step.run) continue;
    const filter = waitingFilter(new Date(now - step.after * MINUTE), floor, step.field);
    const due = await FoodOrder.find(filter).limit(20).lean();
    for (const order of due) {
      const claimed = await FoodOrder.findOneAndUpdate(
        { _id: order._id, ...filter },
        { $set: { [step.field]: now } },
        { new: true }
      ).lean();
      if (!claimed) continue;
      try {
        await step.run(claimed);
        sent += 1;
      } catch (err) {
        console.warn(`[order-alert] ${step.field} failed for ${order._id}:`, err?.message || err);
      }
    }
  }
  return sent;
}

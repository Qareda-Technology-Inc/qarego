import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";
import { sendPushToUserId } from "./pushNotifications.js";
import { buildPushFromTemplate } from "./pushNotificationTemplates.js";
import { sendSMS } from "./smsService.js";
import { normalizePhone } from "./phone.js";
import { isFirebaseConfigured } from "./firebaseAdmin.js";
import { getCommerceOrderCopy, resolveOrderVertical } from "./commerceOrderCopy.js";

function formatOrderTotal(order) {
  const total = Number(order?.total);
  if (!Number.isFinite(total)) return "";
  return `GH₵ ${total.toFixed(2)}`;
}

function formatCustomerName(order) {
  return order?.customer?.name?.trim() || "a customer";
}

function formatItemSummary(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (!items.length) return "New order";
  const summary = items
    .slice(0, 3)
    .map((i) => `${i.quantity || 1}x ${i.name || "item"}`)
    .join(", ");
  return items.length > 3 ? `${summary}…` : summary;
}

function merchantOrdersUrl() {
  const base = (process.env.MERCHANT_ORIGIN || "http://localhost:3001").replace(/\/$/, "");
  return `${base}/orders`;
}

function staffOrderVars(order, restaurantName) {
  const orderId = order?._id?.toString?.() || String(order?._id || "");
  return {
    restaurantName: restaurantName || order?.restaurantName || "your store",
    orderId,
    customerName: formatCustomerName(order),
    orderTotal: formatOrderTotal(order),
    itemSummary: formatItemSummary(order),
  };
}

function staffOrderData(order, restaurantId) {
  return {
    type: "food_new_order",
    orderId: order?._id?.toString?.() || String(order?._id || ""),
    restaurantId: restaurantId?.toString?.() || String(restaurantId || ""),
    status: "PLACED",
  };
}

function buildNewOrderSmsMessage(order, restaurantName, restaurant) {
  const vars = staffOrderVars(order, restaurantName);
  const copy = getCommerceOrderCopy(resolveOrderVertical(order, restaurant));
  const fulfillment =
    order?.fulfillmentType === "PICKUP" ? "Pickup" : "Delivery";
  return (
    `QareGO: New ${fulfillment.toLowerCase()} order at ${vars.restaurantName} ` +
    `from ${vars.customerName}. ${vars.itemSummary}. ${vars.orderTotal}. ` +
    `${copy.smsOpenOrders}: ${merchantOrdersUrl()}`
  ).slice(0, 320);
}

async function buildStaffNewOrderPush(order, restaurantName, restaurantId) {
  const vars = staffOrderVars(order, restaurantName);
  const data = staffOrderData(order, restaurantId);
  const payload = await buildPushFromTemplate("food_new_order_staff", vars, data);
  if (payload) return payload;

  return {
    title: "New order",
    body: `${vars.customerName} · ${vars.itemSummary} · ${vars.orderTotal}`,
    data,
  };
}

/** Owner + all cooks assigned to this restaurant (deduped by user id). */
export async function resolveRestaurantStaff(restaurantId) {
  const restaurant = await Restaurant.findById(restaurantId)
    .select("owner name vertical")
    .lean();
  if (!restaurant) return { restaurant: null, staff: [] };

  const cooks = await User.find({
    role: "cook",
    restaurant: restaurantId,
    isSuspended: { $ne: true },
  })
    .select("_id phone pushTokens name role")
    .lean();

  const owner = restaurant.owner
    ? await User.findById(restaurant.owner)
        .select("_id phone pushTokens name role")
        .lean()
    : null;

  const byId = new Map();
  if (owner?._id) byId.set(String(owner._id), owner);
  for (const cook of cooks) {
    if (cook?._id) byId.set(String(cook._id), cook);
  }

  return {
    restaurant,
    staff: Array.from(byId.values()),
  };
}

async function notifyStaffMember(user, { pushPayload, smsMessage }) {
  const label = `${user.role || "staff"} ${user._id}`;

  if (pushPayload && isFirebaseConfigured()) {
    try {
      const results = await sendPushToUserId(user._id, pushPayload);
      const sent = results.filter((r) => r.result?.ok).length;
      console.log(`[notify] push → ${label}: ${sent}/${results.length} device(s)`);
    } catch (err) {
      console.warn("[notify] push failed:", label, err?.message || err);
    }
  }

  const phone = normalizePhone(user?.phone);
  if (!phone) {
    console.warn(`[notify] sms skipped (no phone): ${label}`);
    return;
  }

  try {
    const result = await sendSMS(phone, smsMessage);
    if (result?.success) {
      console.log(`[notify] sms → ${label} (${phone})`);
    } else {
      console.warn(`[notify] sms failed: ${label}`, result?.error || result);
    }
  } catch (err) {
    console.warn("[notify] sms failed:", label, phone, err?.message || err);
  }
}

/**
 * Notify restaurant owner and assigned cooks when a customer places an order.
 * Sends FCM push (if tokens exist) and SMS (if phone on file). Socket + kitchen audio
 * are handled separately in createFoodOrder.
 */
export function notifyRestaurantStaffNewOrder(restaurantId, order) {
  if (!restaurantId || !order) return;

  void (async () => {
    try {
      const { restaurant, staff } = await resolveRestaurantStaff(restaurantId);
      if (!staff.length) {
        console.warn(
          `[notify] vendor new-order: no owner/cook staff for restaurant ${restaurantId}`
        );
        return;
      }

      console.log(
        `[notify] vendor new-order: restaurant ${restaurantId} → ${staff.length} staff`
      );

      const restaurantName = restaurant?.name || order?.restaurantName || "Store";
      const pushPayload = await buildStaffNewOrderPush(
        order,
        restaurantName,
        restaurantId
      );
      const smsMessage = buildNewOrderSmsMessage(order, restaurantName, restaurant);

      for (const user of staff) {
        await notifyStaffMember(user, { pushPayload, smsMessage });
      }
    } catch (err) {
      console.warn(
        "[notify] vendor new-order batch failed:",
        err?.message || err
      );
    }
  })();
}

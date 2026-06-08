import User from "../models/User.js";
import { getFirebaseMessaging, isFirebaseConfigured } from "./firebaseAdmin.js";
import { buildPushFromTemplate } from "./pushNotificationTemplates.js";
import { getCommerceOrderCopy, resolveOrderVertical } from "./commerceOrderCopy.js";

/** Load push tokens for a user and send to all registered devices. */
export async function sendPushToUserId(userId, payload) {
  if (!userId || !payload) return [];
  const user = await User.findById(userId).select("pushTokens").lean();
  return sendPushToUserTokens(user?.pushTokens || [], payload);
}

function formatFare(ride) {
  return ride?.fare != null ? `GH₵ ${Number(ride.fare).toFixed(2)}` : "";
}

function formatPickup(ride) {
  const pickup = ride?.pickup?.address || ride?.pickup?.name || "Pickup";
  return pickup.length > 42 ? `${pickup.slice(0, 39)}…` : pickup;
}

function rideTemplateVars(ride) {
  const id = ride?._id?.toString?.() || String(ride?._id || "");
  return {
    fare: formatFare(ride),
    pickup: formatPickup(ride),
    rideId: id,
  };
}

function rideOfferData(ride) {
  const id = ride?._id?.toString?.() || String(ride?._id || "");
  const isFood = !!ride?.foodOrder;
  return {
    type: "ride_offer",
    rideId: id,
    foodOrder: isFood ? "1" : "0",
  };
}

/** Build FCM payload for a ride / delivery offer. */
export async function buildRideOfferPushPayload(ride) {
  const isFood = !!ride?.foodOrder;
  const key = isFood ? "ride_offer_delivery" : "ride_offer_trip";
  const payload = await buildPushFromTemplate(key, rideTemplateVars(ride), rideOfferData(ride));
  if (payload) return payload;

  const fare = formatFare(ride);
  const pickup = formatPickup(ride);
  return {
    title: isFood ? "New delivery offer" : "New trip offer",
    body: fare ? `${fare} · ${pickup}` : pickup,
    data: rideOfferData(ride),
  };
}

/** Fire-and-forget FCM for riders in an offer wave (does not block socket emit). */
export function notifyRidersPushOffer(riders, ride) {
  if (!isFirebaseConfigured() || !riders?.length || !ride) return;
  void (async () => {
    try {
      const payload = await buildRideOfferPushPayload(ride);
      for (const row of riders) {
        const riderId = row?.rider?._id || row?.rider?.id || row?.riderId;
        if (!riderId) continue;
        void sendPushToUserId(riderId, payload).catch((err) => {
          console.warn("[push] ride offer notify failed:", riderId, err?.message || err);
        });
      }
    } catch (err) {
      console.warn("[push] ride offer batch failed:", err?.message || err);
    }
  })();
}

/**
 * Send FCM notification to one device token (from expo-notifications getDevicePushTokenAsync).
 */
export async function sendFcmToToken(token, { title, body, data = {} }) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    console.warn("[push] Firebase not configured — skip FCM send");
    return { ok: false, reason: "firebase_not_configured" };
  }

  try {
    const messageId = await messaging.send({
      token,
      notification: title || body ? { title: title || "QareGO", body: body || "" } : undefined,
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v ?? "")])
      ),
      android: {
        priority: "high",
        notification: { channelId: "default", sound: "default" },
      },
      apns: {
        payload: { aps: { sound: "default" } },
      },
    });
    return { ok: true, messageId };
  } catch (err) {
    console.error("[push] FCM send failed:", err?.message || err);
    return { ok: false, reason: err?.code || "send_failed", error: err?.message };
  }
}

/**
 * Send via Expo Push API (optional; useful in Expo Go).
 */
export async function sendExpoPushToToken(expoPushToken, { title, body, data = {} }) {
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  const messages = [
    {
      to: expoPushToken,
      sound: "default",
      title: title || "QareGO",
      body: body || "",
      data,
      channelId: "default",
    },
  ];

  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers,
    body: JSON.stringify(messages),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[push] Expo send failed:", json);
    return { ok: false, reason: "expo_send_failed", detail: json };
  }
  return { ok: true, detail: json };
}

export async function sendPushToUserTokens(tokens, payload) {
  const results = [];
  for (const entry of tokens || []) {
    if (!entry?.token) continue;
    if (entry.provider === "expo") {
      results.push({ ...entry, result: await sendExpoPushToToken(entry.token, payload) });
    } else {
      results.push({ ...entry, result: await sendFcmToToken(entry.token, payload) });
    }
  }
  return results;
}

export function isPushConfigured() {
  return isFirebaseConfigured();
}

const FOOD_STATUS_TEMPLATE_KEY = {
  PLACED: "food_placed",
  PREPARING: "food_preparing",
  READY_FOR_PICKUP: null,
  PICKED_UP: "food_picked_up",
  DELIVERED: "food_delivered",
  CANCELLED: "food_cancelled",
};

function foodOrderVars(order) {
  const orderId = order?._id?.toString?.() || String(order?._id || "");
  const vertical = resolveOrderVertical(order, order?.restaurant);
  const copy = getCommerceOrderCopy(vertical);
  const name =
    order?.restaurantName || order?.restaurant?.name || "Store";
  return {
    restaurantName: name,
    orderId,
    cancelReason: order?.cancelReason || "Your order was cancelled",
    vertical,
    preparingPhrase: copy.pushPreparing,
    deliveredPhrase: copy.pushEnjoyDelivered,
  };
}

function foodOrderData(order) {
  return {
    type: "food_order",
    orderId: order?._id?.toString?.() || String(order?._id || ""),
    status: String(order?.status || ""),
  };
}

/** Customer push for food order lifecycle (socket + FCM). */
export async function buildFoodOrderCustomerPush(order) {
  const status = order?.status;
  let key = FOOD_STATUS_TEMPLATE_KEY[status];

  if (status === "READY_FOR_PICKUP") {
    key =
      order?.fulfillmentType === "PICKUP"
        ? "food_ready_pickup"
        : "food_ready_delivery";
  }

  if (!key) return null;

  const vars = foodOrderVars(order);
  const data = foodOrderData(order);
  const payload = await buildPushFromTemplate(key, vars, data);
  if (payload) return payload;

  switch (status) {
    case "PLACED":
      return {
        title: "Order placed",
        body: `${vars.restaurantName} received your order`,
        data,
      };
    case "PREPARING":
      return {
        title: "Order confirmed",
        body: `${vars.restaurantName} ${vars.preparingPhrase}`,
        data,
      };
    case "READY_FOR_PICKUP":
      return order?.fulfillmentType === "PICKUP"
        ? {
            title: "Ready for pickup",
            body: `Pick up your order at ${vars.restaurantName}`,
            data,
          }
        : {
            title: "Order ready",
            body: "Finding a driver for your delivery",
            data,
          };
    case "PICKED_UP":
      return {
        title: "On the way",
        body: `Your order from ${vars.restaurantName} is on the way`,
        data,
      };
    case "DELIVERED":
      return {
        title: "Delivered",
        body: `${vars.deliveredPhrase} ${vars.restaurantName}!`,
        data,
      };
    case "CANCELLED":
      return {
        title: "Order cancelled",
        body: vars.cancelReason,
        data,
      };
    default:
      return null;
  }
}

export function notifyCustomerFoodOrderPush(customerId, order) {
  if (!isFirebaseConfigured() || !customerId || !order) return;
  void (async () => {
    try {
      const payload = await buildFoodOrderCustomerPush(order);
      if (!payload) return;
      await sendPushToUserId(customerId, payload);
    } catch (err) {
      console.warn(
        "[push] food order customer notify failed:",
        customerId,
        err?.message || err
      );
    }
  })();
}

/** Rider assigned directly to a food delivery (merchant assign or accept). */
export function notifyRiderAssignedFoodDelivery(riderId, ride) {
  if (!riderId || !ride) return;
  void (async () => {
    try {
      const payload =
        (await buildPushFromTemplate(
          "ride_delivery_assigned",
          rideTemplateVars(ride),
          rideOfferData(ride)
        )) || (await buildRideOfferPushPayload(ride));
      if (payload) payload.title = payload.title || "New delivery assigned";
      await sendPushToUserId(riderId, payload);
    } catch (err) {
      console.warn(
        "[push] assigned delivery notify failed:",
        riderId,
        err?.message || err
      );
    }
  })();
}

/** Customer notified when rider accepts food delivery. */
export function notifyCustomerFoodDriverAssigned(customerId, order) {
  if (!isFirebaseConfigured() || !customerId || !order) return;
  void (async () => {
    try {
      const payload = await buildPushFromTemplate(
        "food_driver_assigned",
        foodOrderVars(order),
        { ...foodOrderData(order), status: "DRIVER_ASSIGNED" }
      );
      if (!payload) return;
      await sendPushToUserId(customerId, payload);
    } catch (err) {
      console.warn(
        "[push] food driver assigned notify failed:",
        customerId,
        err?.message || err
      );
    }
  })();
}

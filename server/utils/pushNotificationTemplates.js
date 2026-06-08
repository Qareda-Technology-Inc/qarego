import { getSettings } from "./tripSettlement.js";

/** @typedef {{ title: string; body: string; enabled?: boolean }} PushTemplateValue */

/**
 * Catalog of push templates. Admin can override title/body/enabled per key in Settings.
 * Use {{variableName}} in title/body — missing vars become empty string.
 */
export const PUSH_TEMPLATE_CATALOG = [
  {
    key: "ride_offer_trip",
    label: "New trip offer (rider)",
    audience: "rider",
    description: "Sent when a passenger ride is offered to on-duty riders.",
    variables: ["fare", "pickup", "rideId"],
    defaultTitle: "New trip offer",
    defaultBody: "{{fare}} · {{pickup}}",
  },
  {
    key: "ride_offer_delivery",
    label: "New delivery offer (rider)",
    audience: "rider",
    description: "Store order delivery broadcast to eligible riders.",
    variables: ["fare", "pickup", "rideId"],
    defaultTitle: "New delivery offer",
    defaultBody: "{{fare}} · {{pickup}}",
  },
  {
    key: "ride_delivery_assigned",
    label: "Delivery assigned (rider)",
    audience: "rider",
    description: "Merchant assigned this store delivery directly to a rider.",
    variables: ["fare", "pickup", "rideId"],
    defaultTitle: "New delivery assigned",
    defaultBody: "{{fare}} · {{pickup}}",
  },
  {
    key: "food_placed",
    label: "Order placed (customer)",
    audience: "customer",
    description: "Customer placed a store order.",
    variables: ["restaurantName", "orderId"],
    defaultTitle: "Order placed",
    defaultBody: "{{restaurantName}} received your order",
  },
  {
    key: "food_preparing",
    label: "Order confirmed (customer)",
    audience: "customer",
    description: "Store accepted and is preparing the order.",
    variables: ["restaurantName", "orderId"],
    defaultTitle: "Order confirmed",
    defaultBody: "{{restaurantName}} is preparing your order",
  },
  {
    key: "food_ready_delivery",
    label: "Finding driver (customer)",
    audience: "customer",
    description: "Order ready; dispatching a rider for delivery.",
    variables: ["restaurantName", "orderId"],
    defaultTitle: "Order ready",
    defaultBody: "Finding a driver for your delivery",
  },
  {
    key: "food_ready_pickup",
    label: "Ready for pickup (customer)",
    audience: "customer",
    description: "Customer pickup order is ready at the store.",
    variables: ["restaurantName", "orderId"],
    defaultTitle: "Ready for pickup",
    defaultBody: "Pick up your order at {{restaurantName}}",
  },
  {
    key: "food_driver_assigned",
    label: "Driver assigned (customer)",
    audience: "customer",
    description: "A rider accepted the store delivery.",
    variables: ["restaurantName", "orderId"],
    defaultTitle: "Driver assigned",
    defaultBody: "Heading to {{restaurantName}} to collect your order",
  },
  {
    key: "food_picked_up",
    label: "On the way (customer)",
    audience: "customer",
    description: "Rider picked up the order and is en route.",
    variables: ["restaurantName", "orderId"],
    defaultTitle: "On the way",
    defaultBody: "Your order from {{restaurantName}} is on the way",
  },
  {
    key: "food_delivered",
    label: "Delivered (customer)",
    audience: "customer",
    description: "Store order delivery completed.",
    variables: ["restaurantName", "orderId"],
    defaultTitle: "Delivered",
    defaultBody: "Your order from {{restaurantName}} has arrived!",
  },
  {
    key: "food_cancelled",
    label: "Order cancelled (customer)",
    audience: "customer",
    description: "Store order was cancelled.",
    variables: ["restaurantName", "orderId", "cancelReason"],
    defaultTitle: "Order cancelled",
    defaultBody: "{{cancelReason}}",
  },
  {
    key: "food_new_order_staff",
    label: "New order (vendor & cook)",
    audience: "merchant",
    description:
      "Sent to the store owner and staff when a customer places an order.",
    variables: [
      "restaurantName",
      "orderId",
      "customerName",
      "orderTotal",
      "itemSummary",
    ],
    defaultTitle: "New order",
    defaultBody: "{{customerName}} · {{itemSummary}} · {{orderTotal}}",
  },
  {
    key: "test_push",
    label: "Test notification",
    audience: "any",
    description: "Sent from Account → Test push in the mobile app.",
    variables: [],
    defaultTitle: "QareGO",
    defaultBody: "Firebase push notifications are working.",
  },
];

const CATALOG_BY_KEY = Object.fromEntries(
  PUSH_TEMPLATE_CATALOG.map((t) => [t.key, t])
);

let cache = null;
let cacheAt = 0;
const CACHE_MS = 15_000;

export function invalidatePushTemplateCache() {
  cache = null;
  cacheAt = 0;
}

/** Merge DB overrides with catalog defaults. */
export function mergePushTemplates(stored) {
  const overrides =
    stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};

  return PUSH_TEMPLATE_CATALOG.map((def) => {
    const custom = overrides[def.key];
    const title =
      typeof custom?.title === "string" && custom.title.trim()
        ? custom.title.trim()
        : def.defaultTitle;
    const body =
      typeof custom?.body === "string" && custom.body.trim()
        ? custom.body.trim()
        : def.defaultBody;
    const enabled = custom?.enabled === false ? false : true;

    return {
      key: def.key,
      label: def.label,
      audience: def.audience,
      description: def.description,
      variables: def.variables,
      defaultTitle: def.defaultTitle,
      defaultBody: def.defaultBody,
      title,
      body,
      enabled,
    };
  });
}

export async function getPushTemplatesList() {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_MS) return cache;

  const settings = await getSettings();
  const list = mergePushTemplates(settings.pushNotificationTemplates);
  cache = list;
  cacheAt = now;
  return list;
}

export function getTemplateByKey(list, key) {
  return list.find((t) => t.key === key) || null;
}

/** Replace {{var}} placeholders; strips unknown placeholders to empty. */
export function renderPushTemplateString(template, vars = {}) {
  if (!template || typeof template !== "string") return "";
  const rendered = template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const v = vars[name];
    return v == null ? "" : String(v);
  });
  return rendered.replace(/\s{2,}/g, " ").trim();
}

/**
 * Build FCM payload from template key.
 * @returns {Promise<{ title: string; body: string; data: object } | null>}
 */
export async function buildPushFromTemplate(key, vars, data = {}) {
  const list = await getPushTemplatesList();
  const tpl = getTemplateByKey(list, key);
  if (!tpl || !tpl.enabled) return null;

  const title = renderPushTemplateString(tpl.title, vars);
  const body = renderPushTemplateString(tpl.body, vars);
  if (!title && !body) return null;

  return {
    title: title || "QareGO",
    body: body || "",
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v ?? "")])
    ),
  };
}

/** Validate admin PATCH body: { [key]: { title?, body?, enabled? } } */
export function normalizePushTemplateOverrides(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "pushNotificationTemplates must be an object" };
  }

  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (!CATALOG_BY_KEY[key]) {
      return { ok: false, message: `Unknown template key: ${key}` };
    }
    if (!value || typeof value !== "object") continue;

    const entry = {};
    if (typeof value.title === "string") {
      const t = value.title.trim().slice(0, 120);
      if (t) entry.title = t;
    }
    if (typeof value.body === "string") {
      const b = value.body.trim().slice(0, 500);
      if (b) entry.body = b;
    }
    if (typeof value.enabled === "boolean") {
      entry.enabled = value.enabled;
    }
    if (Object.keys(entry).length) out[key] = entry;
  }

  return { ok: true, value: out };
}

export function catalogForAdminResponse() {
  return PUSH_TEMPLATE_CATALOG.map(({ key, label, audience, description, variables, defaultTitle, defaultBody }) => ({
    key,
    label,
    audience,
    description,
    variables,
    defaultTitle,
    defaultBody,
  }));
}

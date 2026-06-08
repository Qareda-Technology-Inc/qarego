/** Vertical-aware customer / merchant / rider copy for commerce orders (food, grocery, pharmacy). */

const COPY = {
  FOOD: {
    pushPreparing: "is preparing your food",
    pushEnjoyDelivered: "Enjoy your meal from",
    smsOpenOrders: "Open kitchen",
  },
  GROCERY: {
    pushPreparing: "is preparing your order",
    pushEnjoyDelivered: "Your order from",
    smsOpenOrders: "Open orders",
  },
  PHARMACY: {
    pushPreparing: "is preparing your order",
    pushEnjoyDelivered: "Your order from",
    smsOpenOrders: "Open orders",
  },
};

export function normalizeCommerceVertical(value) {
  const v = String(value ?? "FOOD").toUpperCase();
  if (v === "GROCERY" || v === "PHARMACY") return v;
  return "FOOD";
}

export function getCommerceOrderCopy(vertical) {
  return COPY[normalizeCommerceVertical(vertical)];
}

export function resolveOrderVertical(order, restaurant) {
  const fromRestaurant = restaurant?.vertical || order?.restaurant?.vertical;
  if (fromRestaurant) return normalizeCommerceVertical(fromRestaurant);
  return "FOOD";
}

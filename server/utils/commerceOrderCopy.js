/** Vertical-aware customer / merchant / rider copy for commerce orders (food, grocery, pharmacy, gas, laundry). */

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
  GAS: {
    pushPreparing: "is getting your gas ready",
    pushEnjoyDelivered: "Your gas from",
    smsOpenOrders: "Open orders",
  },
  LAUNDRY: {
    pushPreparing: "accepted your laundry. A rider is coming to collect it",
    pushEnjoyDelivered: "Your clean laundry from",
    smsOpenOrders: "Open orders",
  },
};

export function normalizeCommerceVertical(value) {
  const v = String(value ?? "FOOD").toUpperCase();
  if (v === "GROCERY" || v === "PHARMACY" || v === "GAS" || v === "LAUNDRY") return v;
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

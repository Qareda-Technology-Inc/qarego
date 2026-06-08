import {
  normalizeStoreVertical,
  resolveStoreVertical,
  type StoreVertical,
} from "./storeVertical";
import type { Restaurant } from "@/service/foodService";

export type { StoreVertical };

export type CommerceOrderCopy = {
  storeEmoji: string;
  storeNoun: string;
  storeNameFallback: string;
  merchantOrdersTab: string;
  merchantOrdersTitle: string;
  merchantInProgressStat: string;
  merchantActiveFilter: string;
  merchantMenuNav: string;
  merchantOpenOrders: string;
  merchantStaffWorkload: string;
  merchantMapPickupTitle: string;
  customerOrderMore: string;
  customerBackToShop: string;
  customerEnjoyDelivered: string;
  customerWaitingAccept: string;
  customerRateStore: string;
  trackingSentToStore: string;
  trackingStoreAccepted: string;
  trackingPreparing: string;
  trackingPrepWorking: string;
  trackingReadyCourier: string;
  trackingCourierAssigned: string;
  trackingCourierToStore: string;
  trackingOnTheWay: string;
  trackingDeliveredStep: string;
  trackingCancelledStore: string;
  trackingWaitingStore: string;
  trackingPreparingHero: string;
  trackingStoreCooking: string;
  trackingCourierAtStore: string;
  trackingModuleHome: string;
  riderPickupLabel: string;
  riderHeadingToPickup: string;
  riderAtPickup: string;
  riderMeetAtPickup: string;
  riderOfferPrefix: string;
  riderOfferFallback: string;
  riderOfferTitle: string;
  riderNewOfferTitle: string;
  riderOfferBadge: string;
  liveEnjoy: string;
  liveCourierAtStore: string;
  liveDeliveryFallback: string;
  pushPreparingFood: string;
  pushEnjoyDelivered: string;
};

const COPY: Record<StoreVertical, CommerceOrderCopy> = {
  FOOD: {
    storeEmoji: "🍽️",
    storeNoun: "restaurant",
    storeNameFallback: "Restaurant",
    merchantOrdersTab: "Kitchen",
    merchantOrdersTitle: "Kitchen orders",
    merchantInProgressStat: "In kitchen",
    merchantActiveFilter: "In kitchen",
    merchantMenuNav: "Menu Builder",
    merchantOpenOrders: "Open kitchen",
    merchantStaffWorkload: "kitchen workload",
    merchantMapPickupTitle: "Restaurant (pickup)",
    customerOrderMore: "Order more food",
    customerBackToShop: "Back to food",
    customerEnjoyDelivered: "Enjoy your meal!",
    customerWaitingAccept: "Waiting for restaurant to accept…",
    customerRateStore: "Rate",
    trackingSentToStore: "Sent to restaurant",
    trackingStoreAccepted: "Restaurant accepted",
    trackingPreparing: "Preparing your food",
    trackingPrepWorking: "Kitchen is working on it",
    trackingReadyCourier: "Waiting for courier",
    trackingCourierAssigned: "Heading to restaurant",
    trackingCourierToStore: "Courier at restaurant",
    trackingOnTheWay: "Almost there",
    trackingDeliveredStep: "Enjoy your meal",
    trackingCancelledStore: "Restaurant declined or could not fulfil",
    trackingWaitingStore: "Waiting for restaurant",
    trackingPreparingHero: "The restaurant is cooking",
    trackingStoreCooking: "Preparing your order",
    trackingCourierAtStore: "Picking up your order",
    trackingModuleHome: "/customer/hub",
    riderPickupLabel: "Restaurant",
    riderHeadingToPickup: "Heading to restaurant",
    riderAtPickup: "At restaurant",
    riderMeetAtPickup: "Collect at restaurant",
    riderOfferPrefix: "Restaurant",
    riderOfferFallback: "Food order",
    riderOfferTitle: "Food delivery offer",
    riderNewOfferTitle: "New food delivery",
    riderOfferBadge: "Food",
    liveEnjoy: "Enjoy your meal",
    liveCourierAtStore: "Courier at restaurant",
    liveDeliveryFallback: "Food delivery",
    pushPreparingFood: "is preparing your food",
    pushEnjoyDelivered: "Enjoy your meal from",
  },
  GROCERY: {
    storeEmoji: "🛒",
    storeNoun: "store",
    storeNameFallback: "Store",
    merchantOrdersTab: "Orders",
    merchantOrdersTitle: "Store orders",
    merchantInProgressStat: "Being prepared",
    merchantActiveFilter: "In progress",
    merchantMenuNav: "Product catalog",
    merchantOpenOrders: "Open orders",
    merchantStaffWorkload: "order queue",
    merchantMapPickupTitle: "Store (pickup)",
    customerOrderMore: "Order again",
    customerBackToShop: "Back to groceries",
    customerEnjoyDelivered: "Enjoy your order!",
    customerWaitingAccept: "Waiting for store to accept…",
    customerRateStore: "Rate",
    trackingSentToStore: "Sent to store",
    trackingStoreAccepted: "Store accepted",
    trackingPreparing: "Preparing your order",
    trackingPrepWorking: "Store is picking your items",
    trackingReadyCourier: "Waiting for courier",
    trackingCourierAssigned: "Heading to store",
    trackingCourierToStore: "Courier at store",
    trackingOnTheWay: "Almost there",
    trackingDeliveredStep: "Enjoy your order",
    trackingCancelledStore: "Store declined or could not fulfil",
    trackingWaitingStore: "Waiting for store",
    trackingPreparingHero: "The store is preparing your order",
    trackingStoreCooking: "Preparing your order",
    trackingCourierAtStore: "Collecting your order",
    trackingModuleHome: "/customer/stores?type=GROCERY",
    riderPickupLabel: "Store",
    riderHeadingToPickup: "Heading to store",
    riderAtPickup: "At store",
    riderMeetAtPickup: "Collect at store",
    riderOfferPrefix: "Store",
    riderOfferFallback: "Grocery order",
    riderOfferTitle: "Grocery delivery offer",
    riderNewOfferTitle: "New grocery delivery",
    riderOfferBadge: "Grocery",
    liveEnjoy: "Order delivered",
    liveCourierAtStore: "Courier at store",
    liveDeliveryFallback: "Grocery delivery",
    pushPreparingFood: "is preparing your order",
    pushEnjoyDelivered: "Your order from",
  },
  PHARMACY: {
    storeEmoji: "💊",
    storeNoun: "pharmacy",
    storeNameFallback: "Pharmacy",
    merchantOrdersTab: "Orders",
    merchantOrdersTitle: "Pharmacy orders",
    merchantInProgressStat: "Being prepared",
    merchantActiveFilter: "In progress",
    merchantMenuNav: "Product catalog",
    merchantOpenOrders: "Open orders",
    merchantStaffWorkload: "order queue",
    merchantMapPickupTitle: "Pharmacy (pickup)",
    customerOrderMore: "Order again",
    customerBackToShop: "Back to pharmacy",
    customerEnjoyDelivered: "Enjoy your order!",
    customerWaitingAccept: "Waiting for pharmacy to accept…",
    customerRateStore: "Rate",
    trackingSentToStore: "Sent to pharmacy",
    trackingStoreAccepted: "Pharmacy accepted",
    trackingPreparing: "Preparing your order",
    trackingPrepWorking: "Pharmacy is preparing your order",
    trackingReadyCourier: "Waiting for courier",
    trackingCourierAssigned: "Heading to pharmacy",
    trackingCourierToStore: "Courier at pharmacy",
    trackingOnTheWay: "Almost there",
    trackingDeliveredStep: "Enjoy your order",
    trackingCancelledStore: "Pharmacy declined or could not fulfil",
    trackingWaitingStore: "Waiting for pharmacy",
    trackingPreparingHero: "The pharmacy is preparing your order",
    trackingStoreCooking: "Preparing your order",
    trackingCourierAtStore: "Collecting your order",
    trackingModuleHome: "/customer/stores?type=PHARMACY",
    riderPickupLabel: "Pharmacy",
    riderHeadingToPickup: "Heading to pharmacy",
    riderAtPickup: "At pharmacy",
    riderMeetAtPickup: "Collect at pharmacy",
    riderOfferPrefix: "Pharmacy",
    riderOfferFallback: "Pharmacy order",
    riderOfferTitle: "Pharmacy delivery offer",
    riderNewOfferTitle: "New pharmacy delivery",
    riderOfferBadge: "Pharmacy",
    liveEnjoy: "Order delivered",
    liveCourierAtStore: "Courier at pharmacy",
    liveDeliveryFallback: "Pharmacy delivery",
    pushPreparingFood: "is preparing your order",
    pushEnjoyDelivered: "Your order from",
  },
};

export function normalizeCommerceVertical(value?: unknown): StoreVertical {
  return normalizeStoreVertical(
    typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined
  );
}

export function getCommerceOrderCopy(vertical?: StoreVertical | string | null): CommerceOrderCopy {
  return COPY[normalizeCommerceVertical(vertical)];
}

export function resolveOrderVertical(input?: {
  vertical?: unknown;
  storeVertical?: unknown;
  restaurant?: Restaurant | { vertical?: string; name?: string; category?: string; cuisine?: string } | null;
  restaurantName?: string;
} | null): StoreVertical {
  if (input?.vertical) return normalizeCommerceVertical(input.vertical);
  if (input?.storeVertical) return normalizeCommerceVertical(input.storeVertical);
  if (input?.restaurant) return resolveStoreVertical(input.restaurant as Restaurant);
  return "FOOD";
}

export function commerceHomePath(vertical: StoreVertical): string {
  if (vertical === "FOOD") return "/customer/hub";
  return `/customer/stores?type=${vertical}`;
}

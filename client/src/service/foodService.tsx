import { router } from "expo-router";
import { appAxios } from "./apiInterceptors";
import { Alert } from "react-native";
import { FoodOrderStatus } from "@/utils/foodOrderTracking";

export type Restaurant = {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  vertical?: "FOOD" | "GROCERY" | "PHARMACY";
  /** Selected cuisine / department / pharmacy tags */
  tags?: string[];
  cuisine?: string;
  imageEmoji?: string;
  imageUrl?: string | null;
  rating?: number;
  ratingCount?: number;
  deliveryFee: number;
  minOrderAmount?: number;
  estimatedPrepMinutes?: number;
  address?: string;
  isOpen?: boolean;
  openStatus?: "open" | "paused" | "closed" | "unavailable";
  openLabel?: string;
  todayHours?: string | null;
  latitude?: number;
  longitude?: number;
  allowsPickup?: boolean;
  createdAt?: string;
};

export type FoodPromoBanner = {
  imageUrl: string;
  vertical?: string;
};

export type MenuCategoryMeta = {
  _id?: string | null;
  name: string;
  displayLayout: "row" | "column";
  sortOrder?: number;
};

export type MenuModifierOption = {
  _id: string;
  name: string;
  priceDelta: number;
  isDefault?: boolean;
  isAvailable?: boolean;
};

export type MenuModifierGroup = {
  _id: string;
  name: string;
  kind: "choose_one" | "add_ons";
  required?: boolean;
  options: MenuModifierOption[];
};

export type MenuItem = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  imageUrl?: string | null;
  tags?: string[];
  badge?: "discount" | null;
  discountLabel?: string | null;
  discountPercent?: number | null;
  originalPrice?: number | null;
  displayLayout?: "row" | "column";
  modifierGroups?: MenuModifierGroup[];
};

export type FoodOrder = {
  _id: string;
  restaurantName: string;
  restaurant?: Restaurant;
  items: { name: string; price: number; quantity: number }[];
  subtotal: number;
  serviceFee?: number;
  deliveryFee: number;
  driverFee: number;
  deliveryDistanceKm?: number | null;
  total: number;
  delivery: { address: string; latitude: number; longitude: number };
  paymentMethod: string;
  status: FoodOrderStatus;
  notes?: string | null;
  cancelReason?: string | null;
  deliveryCode?: string | null;
  fulfillmentType?: "DELIVERY" | "PICKUP" | "SCHEDULED";
  restaurantRating?: number | null;
  restaurantReview?: string | null;
  ride?: {
    _id: string;
    status?: string;
    vehicle?: string;
    otp?: string;
    fare?: number;
    distance?: number;
    rider?: unknown;
    pickup?: { address?: string; latitude?: number; longitude?: number };
    drop?: { address?: string; latitude?: number; longitude?: number };
    serviceType?: string;
    storeVertical?: string;
  } | null;
  createdAt?: string;
};

export const fetchRestaurants = async (): Promise<Restaurant[]> => {
  const res = await appAxios.get("/food/restaurants");
  return res.data?.restaurants ?? [];
};

export const fetchRestaurantMenu = async (restaurantId: string) => {
  const res = await appAxios.get(`/food/restaurants/${restaurantId}`);
  return res.data as {
    restaurant: Restaurant;
    menu: Record<string, MenuItem[]>;
    categories?: MenuCategoryMeta[];
    menuItems: MenuItem[];
  };
};

export type OrderModifierSelection = {
  groupId: string;
  optionIds: string[];
};

export const createFoodOrder = async (payload: {
  restaurantId: string;
  items: {
    menuItemId: string;
    quantity: number;
    modifiers?: OrderModifierSelection[];
  }[];
  delivery: { address: string; latitude: number; longitude: number };
  paymentMethod?: "CASH" | "MOBILE_MONEY";
  notes?: string;
  fulfillmentType?: "DELIVERY" | "PICKUP" | "SCHEDULED";
  scheduledFor?: string;
  promoCode?: string;
}) => {
  try {
    const res = await appAxios.post("/food/orders", payload);
    const orderId = res?.data?.order?._id;
    if (orderId) {
      router.replace(`/customer/stores/order/${orderId}` as const);
    } else {
      router.replace("/customer/hub");
    }
    return res.data;
  } catch (error: any) {
    const message =
      error?.response?.data?.msg ||
      error?.message ||
      "Could not place your order. Please try again.";
    Alert.alert("Order failed", message);
    throw error;
  }
};

export const fetchFoodOrder = async (orderId: string): Promise<FoodOrder | null> => {
  const res = await appAxios.get(`/food/orders/${orderId}`);
  return res.data?.order ?? null;
};

export const rateFoodOrder = async (orderId: string, rating: number, review?: string) => {
  const res = await appAxios.post(`/food/orders/${orderId}/rate`, { rating, review });
  return res.data;
};

export const fetchActiveFoodOrder = async (): Promise<FoodOrder | null> => {
  const res = await appAxios.get("/food/orders/active");
  return res.data?.order ?? null;
};

export const fetchMyFoodOrders = async (): Promise<FoodOrder[]> => {
  const res = await appAxios.get("/food/orders");
  return res.data?.orders ?? [];
};

export type FoodCheckoutSettings = {
  serviceFeeRate: number;
  serviceFeeMin: number;
  serviceFeeMax: number;
  fareRates: Record<string, { baseFare: number; perKmRate: number; minimumFare: number }> | null;
  promoBanners?: FoodPromoBanner[];
};

export type FoodDeliveryQuote = {
  distanceKm: number;
  deliveryFee: number;
};

export const fetchFoodDeliveryQuote = async (
  restaurantId: string,
  latitude: number,
  longitude: number
): Promise<FoodDeliveryQuote> => {
  const res = await appAxios.get("/food/delivery-quote", {
    params: { restaurantId, latitude, longitude },
  });
  return {
    distanceKm: Number(res.data?.distanceKm ?? 0),
    deliveryFee: Number(res.data?.deliveryFee ?? 0),
  };
};

export const fetchFoodCheckoutSettings = async (
  vertical?: string
): Promise<FoodCheckoutSettings> => {
  const res = await appAxios.get("/food/checkout-settings", {
    params: vertical ? { vertical } : undefined,
  });
  return {
    serviceFeeRate: Number(res.data?.serviceFeeRate ?? 0.08),
    serviceFeeMin: Number(res.data?.serviceFeeMin ?? 2),
    serviceFeeMax: Number(res.data?.serviceFeeMax ?? 12),
    fareRates: res.data?.fareRates ?? null,
    promoBanners: res.data?.promoBanners ?? [],
  };
};

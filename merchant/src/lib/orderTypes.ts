export type FoodOrderRow = {
  _id: string;
  status: string;
  total: number;
  subtotal: number;
  /** Store's share after commission (food subtotal − commission), frozen at checkout. */
  restaurantNet?: number | null;
  /** Cooking gas orders */
  gasMode?: "REFILL" | "EXCHANGE" | null;
  gasStage?: "TO_STATION" | "AT_STATION" | null;
  gasSizeKg?: number | null;
  gasEmptyReturnedAt?: string | null;
  /** Laundry orders: the customer's estimate, then the shop's count. */
  laundry?: {
    estimatedSubtotal: number;
    estimatedItemCount: number;
    priceStatus: "estimate" | "awaiting_customer" | "approved" | "declined";
    countedAt?: string | null;
    countedItemCount?: number | null;
    previousSubtotal?: number | null;
    /** Booked collection window start; null = collect as soon as accepted. */
    pickupAt?: string | null;
  } | null;
  items: {
    menuItem?: string;
    name: string;
    quantity: number;
    price: number;
    modifiers?: { groupName?: string; optionName: string; priceDelta?: number }[];
  }[];
  delivery: { address: string; latitude?: number; longitude?: number };
  customer?: { name?: string; phone?: string };
  paymentMethod?: "CASH" | "MOBILE_MONEY";
  fulfillmentType?: "DELIVERY" | "PICKUP" | "SCHEDULED";
  /** SCHEDULED: when the customer wants it delivered. */
  scheduledFor?: string | null;
  /** SCHEDULED: when to start cooking so it's ready as the rider arrives. */
  kitchenStartAt?: string | null;
  /** When the rider request goes out (scheduled orders wait for this). */
  courierBroadcastAt?: string | null;
  deliveryCode?: string | null;
  restaurantRating?: number | null;
  ride?: {
    _id?: string;
    status?: string;
    rider?: { name?: string; phone?: string };
  } | null;
  createdAt: string;
  updatedAt?: string;
  /** When the store accepted the order. */
  preparingStartedAt?: string | null;
  notes?: string;
  prescriptionUrls?: string[];
};

export type OrdersListResponse = {
  orders: FoodOrderRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

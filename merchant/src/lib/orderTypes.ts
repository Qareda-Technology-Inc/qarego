export type FoodOrderRow = {
  _id: string;
  status: string;
  total: number;
  subtotal: number;
  serviceFee?: number;
  deliveryFee?: number;
  items: {
    name: string;
    quantity: number;
    price: number;
    modifiers?: { groupName?: string; optionName: string; priceDelta?: number }[];
  }[];
  delivery: { address: string; latitude?: number; longitude?: number };
  customer?: { name?: string; phone?: string };
  paymentMethod?: "CASH" | "MOBILE_MONEY";
  fulfillmentType?: "DELIVERY" | "PICKUP" | "SCHEDULED";
  deliveryCode?: string | null;
  restaurantRating?: number | null;
  ride?: {
    _id?: string;
    status?: string;
    rider?: { name?: string; phone?: string };
  } | null;
  createdAt: string;
  notes?: string;
};

export type OrdersListResponse = {
  orders: FoodOrderRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

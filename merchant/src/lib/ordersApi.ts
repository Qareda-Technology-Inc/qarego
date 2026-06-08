import { fetcher } from "@/lib/api";
import type { OrdersListResponse } from "@/lib/orderTypes";

export type OrdersQuery = {
  view?: "kitchen" | "history" | "all";
  stage?: "pending" | "active";
  status?: string;
  from?: string;
  to?: string;
  paymentMethod?: string;
  fulfillmentType?: string;
  q?: string;
  page?: number;
  limit?: number;
};

export function buildOrdersQueryString(params: OrdersQuery): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== null) {
      qs.set(key, String(value));
    }
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function fetchMerchantOrders(params: OrdersQuery = {}) {
  return fetcher(`/merchant/orders${buildOrdersQueryString(params)}`) as Promise<OrdersListResponse>;
}

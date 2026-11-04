import { appAxios } from "./apiInterceptors";
import type { FoodOrder } from "./foodService";

export type GasMode = "REFILL" | "EXCHANGE";

export type GasCylinder = {
  sizeKg: number;
  label: string;
  refillPrice: number;
  exchangePrice: number;
};

export type GasOptions = {
  enabled: boolean;
  momoEnabled: boolean;
  /** Refill by amount (buy GH₵50 of gas instead of a full cylinder). Missing on older servers. */
  amountRefill?: { enabled: boolean; minAmount: number };
  cylinders: GasCylinder[];
};

export type GasQuote = {
  station: { _id: string; name: string };
  quantity: number;
  unitPrice: number;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  distanceKm: number;
  /** Cedis of gas for a refill bought by amount; null for a full cylinder. */
  gasAmount?: number | null;
  itemName: string;
};

type Point = { latitude: number; longitude: number; address: string };

export const fetchGasOptions = async (): Promise<GasOptions> => {
  const res = await appAxios.get("/food/gas/options");
  return res.data;
};

export const fetchGasQuote = async (
  point: Point,
  mode: GasMode,
  sizeKg: number,
  quantity: number,
  amount?: number | null
): Promise<GasQuote> => {
  const res = await appAxios.get("/food/gas/quote", {
    params: {
      latitude: point.latitude,
      longitude: point.longitude,
      mode,
      sizeKg,
      quantity,
      ...(amount != null ? { amount } : {}),
    },
  });
  return res.data;
};

export const createGasOrder = async (payload: {
  mode: GasMode;
  sizeKg: number;
  quantity: number;
  /** Refill by amount: cedis of gas. Omit for a full cylinder. */
  amount?: number;
  delivery: Point;
  paymentMethod: "CASH" | "MOBILE_MONEY";
  notes?: string;
  /** Same id on a retry → the server returns the first order instead of a duplicate. */
  clientRequestId?: string;
}): Promise<FoodOrder> => {
  const res = await appAxios.post("/food/gas/orders", payload);
  return res.data.order;
};

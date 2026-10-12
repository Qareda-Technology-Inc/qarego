import type { FoodOrder } from "@/service/foodService";

/** Customer rates the rider for motorcycle trips and parcel delivery. */
export function customerRatesRiderForRide(ride: { serviceType?: string } | null): boolean {
  if (!ride) return false;
  return ride.serviceType === "RIDE" || ride.serviceType === "DELIVERY";
}

/** Customer rates the restaurant for food / grocery / pharmacy orders. */
export function isFoodOrderDelivered(order: FoodOrder | null): boolean {
  if (!order) return false;
  return order.status === "DELIVERED" || order.ride?.status === "COMPLETED";
}

/** Customer rates the restaurant for food / grocery / pharmacy orders. */
export function isFoodOrderRateable(order: FoodOrder | null): boolean {
  if (!order || order.restaurantRating) return false;
  if (order.status === "DELIVERED") return true;
  // Courier marked ride complete — order row may still say PICKED_UP until WS/API catches up.
  // (Not the gas collection leg: that only means the empty reached the station.)
  if (order.ride?.status === "COMPLETED" && order.ride?.gasLeg !== "COLLECT") return true;
  return false;
}

/** Sync order status when linked courier ride is completed. */
export function withDeliveredFoodOrderStatus<T extends FoodOrder>(order: T): T {
  if (
    order.status === "DELIVERED" ||
    order.ride?.status !== "COMPLETED" ||
    order.ride?.gasLeg === "COLLECT"
  ) {
    return order;
  }
  return { ...order, status: "DELIVERED" };
}

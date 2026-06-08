import type { FoodOrder } from "@/service/foodService";

/** Customer rates the rider for motorcycle trips and parcel delivery. */
export function customerRatesRiderForRide(ride: { serviceType?: string } | null): boolean {
  if (!ride) return false;
  return ride.serviceType === "RIDE" || ride.serviceType === "DELIVERY";
}

/** Customer rates the restaurant for food / grocery / pharmacy orders. */
export function isFoodOrderRateable(order: FoodOrder | null): boolean {
  if (!order || order.restaurantRating) return false;
  if (order.status === "DELIVERED") return true;
  if (order.fulfillmentType === "PICKUP" && order.status === "READY_FOR_PICKUP") {
    return true;
  }
  return false;
}

import { sortOffersByScore } from "./offerRanking";
import { getCommerceOrderCopy } from "./commerceOrderCopy";

export const ACTIVE_RIDER_RIDE_STATUSES = ["START", "ARRIVED", "IN_PROGRESS"] as const;

export type RiderOfferRide = {
  _id?: string;
  status?: string;
  /** Rider id, or the populated rider. Typed loosely: rides come from several API shapes. */
  rider?: unknown;
  serviceType?: string;
  parcelMode?: unknown;
  storeVertical?: string;
  restaurantName?: string;
  foodOrderSummary?: string;
};

export function riderIdFromUser(user: { _id?: string; id?: string } | null | undefined): string {
  return String(user?._id || user?.id || "");
}

export function rideAssignedRiderId(ride: RiderOfferRide | null | undefined): string {
  const rider = ride?.rider;
  if (!rider) return "";
  if (typeof rider === "string") return rider;
  const r = rider as { _id?: string; id?: string };
  return String(r._id || r.id || "");
}

/** Merchant-assigned or already-accepted trip — not an open offer wave. */
export function isAssignedActiveRide(
  ride: RiderOfferRide | null | undefined,
  riderId: string
): boolean {
  if (!ride?._id || !riderId) return false;
  if (!ACTIVE_RIDER_RIDE_STATUSES.includes(ride.status as (typeof ACTIVE_RIDER_RIDE_STATUSES)[number])) {
    return false;
  }
  return rideAssignedRiderId(ride) === riderId;
}

export function isFoodDelivery(ride?: RiderOfferRide | null): boolean {
  return ride?.serviceType === "FOOD" || !!(ride as { foodOrder?: unknown })?.foodOrder;
}

/** Courier leg for a store order — belongs in food order history, not ride history (customer). */
export function isFoodCourierRide(ride?: { serviceType?: string; foodOrder?: unknown } | null): boolean {
  return ride?.serviceType === "FOOD" || !!ride?.foodOrder;
}

export function getRiderOfferBadge(ride: RiderOfferRide): {
  label: string;
  color: string;
} {
  if (ride.serviceType === "FOOD") {
    const copy = getCommerceOrderCopy(ride?.storeVertical);
    return { label: copy.riderOfferBadge, color: "#f97316" };
  }
  if (ride.serviceType === "DELIVERY") {
    return ride.parcelMode === "RECEIVE"
      ? { label: "Receive", color: "#7c3aed" }
      : { label: "Send", color: "#a855f7" };
  }
  return { label: "Ride", color: "#2563eb" };
}

/** Gas refill first leg runs customer → station (the reverse of a normal delivery). */
const isGasCollect = (ride?: RiderOfferRide | null) =>
  (ride as { gasLeg?: string | null } | null | undefined)?.gasLeg === "COLLECT";

export function getRiderPickupLabel(ride?: RiderOfferRide | null): string {
  if (isGasCollect(ride)) return "Collect empty cylinder";
  if (isFoodDelivery(ride)) {
    return getCommerceOrderCopy(ride?.storeVertical).riderPickupLabel;
  }
  if (ride?.serviceType === "DELIVERY") {
    return ride.parcelMode === "RECEIVE" ? "Collect from" : "Pickup";
  }
  return "Pickup";
}

export function getRiderDropLabel(ride?: RiderOfferRide | null): string {
  if (isGasCollect(ride)) return "Take to gas station";
  if (isFoodDelivery(ride)) return "Customer";
  if (ride?.serviceType === "DELIVERY") {
    return ride.parcelMode === "RECEIVE" ? "Customer" : "Recipient";
  }
  return "Drop";
}

export function mergeRideOffers(existing: any[], incoming: any[]): any[] {
  const map = new Map<string, any>();
  for (const o of existing) {
    if (o?._id) map.set(o._id, o);
  }
  for (const o of incoming) {
    if (o?._id) {
      const prev = map.get(o._id);
      map.set(o._id, prev ? { ...prev, ...o } : o);
    }
  }
  return sortOffersByScore(Array.from(map.values()));
}

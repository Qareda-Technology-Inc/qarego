import {
  getCommerceOrderCopy,
  resolveOrderVertical,
  type StoreVertical,
} from "./commerceOrderCopy";

export type FoodOrderStatus =
  | "PLACED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "PICKED_UP"
  | "DELIVERED"
  | "CANCELLED";

export type TrackingStep = {
  id: string;
  label: string;
  subtitle?: string;
  state: "done" | "active" | "pending";
};

function stepDefs(vertical: StoreVertical): Omit<TrackingStep, "state">[] {
  const c = getCommerceOrderCopy(vertical);
  return [
    { id: "placed", label: "Order placed", subtitle: c.trackingSentToStore },
    { id: "accepted", label: "Order accepted", subtitle: c.trackingStoreAccepted },
    { id: "preparing", label: c.trackingPreparing, subtitle: c.trackingPrepWorking },
    { id: "ready", label: "Ready for pickup", subtitle: c.trackingReadyCourier },
    { id: "courier", label: "Courier assigned", subtitle: c.trackingCourierAssigned },
    { id: "delivery", label: "On the way to you", subtitle: c.trackingOnTheWay },
    { id: "done", label: "Delivered", subtitle: c.trackingDeliveredStep },
  ];
}

function getCurrentStepIndex(
  orderStatus: FoodOrderStatus,
  ride?: { status?: string } | null
): number {
  if (orderStatus === "CANCELLED") return 0;
  if (orderStatus === "DELIVERED" || ride?.status === "COMPLETED") return 6;
  if (ride?.status === "IN_PROGRESS") return 5;
  if (ride?.status === "START" || ride?.status === "ARRIVED") return 4;
  if (ride?.status === "SEARCHING_FOR_RIDER" || orderStatus === "READY_FOR_PICKUP") return 3;
  if (orderStatus === "PREPARING" || orderStatus === "CONFIRMED") return 2;
  if (orderStatus !== "PLACED") return 1;
  return 0;
}

export function buildFoodTrackingSteps(
  orderStatus: FoodOrderStatus,
  ride?: { status?: string; rider?: unknown } | null,
  vertical?: StoreVertical
): TrackingStep[] {
  const v = vertical ?? "FOOD";
  const c = getCommerceOrderCopy(v);

  if (orderStatus === "CANCELLED") {
    return [
      {
        id: "cancelled",
        label: "Order cancelled",
        subtitle: c.trackingCancelledStore,
        state: "active",
      },
    ];
  }

  const current = getCurrentStepIndex(orderStatus, ride);
  const defs = stepDefs(v);

  return defs.map((step, index) => {
    let state: TrackingStep["state"] = "pending";
    if (index < current) state = "done";
    else if (index === current) state = "active";

    if (step.id === "courier" && ride?.status === "SEARCHING_FOR_RIDER") {
      return {
        ...step,
        label: "Finding a courier",
        subtitle: "Matching a driver near you",
        state,
      };
    }

    return { ...step, state };
  });
}

/** Delivery code shown to customer when courier is en route (IN_PROGRESS). */
export function getFoodDeliveryCode(order: {
  deliveryCode?: string | null;
  ride?: { otp?: string } | null;
}): string | null {
  const code = order.deliveryCode || order.ride?.otp;
  return code && String(code).length >= 4 ? String(code) : null;
}

/** Show delivery code on order tracking once a courier ride exists (until delivered). */
export function shouldShowFoodDeliveryCode(
  orderStatus: FoodOrderStatus,
  ride?: { status?: string; _id?: string } | null
): boolean {
  if (!ride?._id) return false;
  if (orderStatus === "DELIVERED" || orderStatus === "CANCELLED") return false;
  if (ride.status === "COMPLETED") return false;
  return [
    "SEARCHING_FOR_RIDER",
    "START",
    "ARRIVED",
    "IN_PROGRESS",
  ].includes(ride.status ?? "");
}

export function getHeroStatusLabel(
  orderStatus: FoodOrderStatus,
  ride?: { status?: string } | null,
  order?: { restaurant?: { vertical?: string }; restaurantName?: string; vertical?: string; storeVertical?: string } | null
): { title: string; subtitle: string } {
  const vertical = resolveOrderVertical(order ?? undefined);
  const c = getCommerceOrderCopy(vertical);

  if (orderStatus === "CANCELLED") {
    return { title: "Order cancelled", subtitle: "You were not charged for this order" };
  }
  if (orderStatus === "DELIVERED" || ride?.status === "COMPLETED") {
    return { title: "Delivered", subtitle: c.customerEnjoyDelivered };
  }
  if (ride?.status === "IN_PROGRESS") {
    return {
      title: "On the way",
      subtitle: "Share your delivery code with the courier when they arrive",
    };
  }
  if (ride?.status === "START" || ride?.status === "ARRIVED") {
    return { title: c.trackingCourierToStore, subtitle: c.trackingCourierAtStore };
  }
  if (ride?.status === "SEARCHING_FOR_RIDER") {
    if (orderStatus === "PREPARING") {
      return {
        title: "Preparing your order",
        subtitle: "Finding a courier while the store cooks",
      };
    }
    return { title: "Finding a courier", subtitle: "Hang tight — matching a driver" };
  }
  if (orderStatus === "READY_FOR_PICKUP") {
    return { title: "Ready for pickup", subtitle: "Waiting for a courier" };
  }
  if (orderStatus === "PREPARING") {
    return { title: c.trackingStoreCooking, subtitle: c.trackingPreparingHero };
  }
  if (orderStatus === "PLACED" || orderStatus === "CONFIRMED") {
    return { title: "Confirming order", subtitle: "Waiting for the store to accept" };
  }
  return { title: c.trackingWaitingStore, subtitle: "They will confirm your order soon" };
}

export type FoodOrderMapPoint = {
  latitude: number;
  longitude: number;
  address?: string;
};

/** Pickup (store) and drop (customer) coordinates for the tracking map. */
export function resolveFoodOrderMapPoints(order: {
  restaurantName: string;
  restaurant?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  } | null;
  delivery: { address: string; latitude: number; longitude: number };
  ride?: {
    pickup?: { address?: string; latitude?: number; longitude?: number };
    drop?: { address?: string; latitude?: number; longitude?: number };
  } | null;
}): { pickup: FoodOrderMapPoint | null; drop: FoodOrderMapPoint | null } {
  const ridePickup = order.ride?.pickup;
  const store = order.restaurant;

  const pickup =
    toMapPoint(ridePickup?.latitude, ridePickup?.longitude, ridePickup?.address) ??
    toMapPoint(store?.latitude, store?.longitude, store?.address || order.restaurantName);

  const rideDrop = order.ride?.drop;
  const drop =
    toMapPoint(
      rideDrop?.latitude,
      rideDrop?.longitude,
      rideDrop?.address || order.delivery.address
    ) ??
    toMapPoint(
      order.delivery.latitude,
      order.delivery.longitude,
      order.delivery.address
    );

  return { pickup, drop };
}

function toMapPoint(
  lat: unknown,
  lon: unknown,
  address?: string
): FoodOrderMapPoint | null {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude, address };
}

export function hasFoodOrderMap(
  order: Parameters<typeof resolveFoodOrderMapPoints>[0]
): boolean {
  const { pickup, drop } = resolveFoodOrderMapPoints(order);
  return !!pickup && !!drop;
}

/** Map from store accept → courier en route; hidden while waiting or after delivery. */
export function shouldShowFoodOrderMap(
  order: Parameters<typeof hasFoodOrderMap>[0] & {
    status: FoodOrderStatus;
    fulfillmentType?: string;
    ride?: { status?: string } | null;
  }
): boolean {
  if (order.fulfillmentType === "PICKUP") return false;
  if (!hasFoodOrderMap(order)) return false;
  if (order.status === "PLACED") return false;
  if (order.status === "DELIVERED" || order.status === "CANCELLED") return false;
  if (order.ride?.status === "COMPLETED") return false;
  return true;
}

/** ETA window label e.g. "30–55 min" for the status card. */
export function getFoodOrderEtaWindow(order: {
  status: FoodOrderStatus;
  restaurant?: { estimatedPrepMinutes?: number } | null;
  ride?: { status?: string } | null;
}): string | null {
  if (order.status === "DELIVERED" || order.status === "CANCELLED") return null;
  if (order.ride?.status === "IN_PROGRESS") return "Arriving soon";
  if (order.ride?.status === "START" || order.ride?.status === "ARRIVED") {
    return "Courier at store";
  }
  const prep = order.restaurant?.estimatedPrepMinutes;
  const base = Math.max(15, prep ?? 30);
  const high = base + 25;
  return `${base}–${high} min`;
}

const LIVE_COURIER_STATUSES = new Set([
  "SEARCHING_FOR_RIDER",
  "START",
  "ARRIVED",
  "IN_PROGRESS",
]);

export function isLiveFoodCourierTracking(
  orderStatus: FoodOrderStatus,
  ride?: { status?: string; _id?: string } | null
): boolean {
  if (!ride?._id) return false;
  if (orderStatus === "CANCELLED" || orderStatus === "DELIVERED") return false;
  return LIVE_COURIER_STATUSES.has(ride.status ?? "");
}

/** Distance (km) used for the delivery fee quote. */
export function getOrderDeliveryDistanceKm(order: {
  deliveryDistanceKm?: number | null;
  ride?: { distance?: number } | null;
}): number | null {
  if (order.deliveryDistanceKm != null && order.deliveryDistanceKm > 0) {
    return order.deliveryDistanceKm;
  }
  if (order.ride?.distance != null && order.ride.distance > 0) {
    return order.ride.distance;
  }
  return null;
}

type CourierRider = {
  driverDetails?: { vehicle?: { category?: string } };
};

/** Ride vehicle, or courier profile category, default motorcycle. */
export function resolveCourierVehicle(order: {
  ride?: { vehicle?: string; rider?: unknown } | null;
}): string {
  if (order.ride?.vehicle) return order.ride.vehicle;
  const rider = order.ride?.rider as CourierRider | undefined;
  const category = rider?.driverDetails?.vehicle?.category;
  return category || "motorcycle";
}

export function getCourierDisplayName(order: {
  ride?: { rider?: unknown } | null;
}): string | null {
  const rider = order.ride?.rider as { name?: string } | undefined;
  return rider?.name?.trim() || null;
}

export function getCourierRating(order: {
  ride?: { rider?: unknown } | null;
}): number | null {
  const rider = order.ride?.rider as { averageRating?: number } | undefined;
  return rider?.averageRating ?? null;
}

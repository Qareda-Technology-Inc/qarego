import { formatCurrency } from "./Constants";
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

type CancelInfo = {
  cancelledBy?: "CUSTOMER" | "RESTAURANT" | "ADMIN" | null;
  cancelReason?: string | null;
  refundStatus?: "NONE" | "DUE" | "REFUNDED";
  gasMode?: "REFILL" | "EXCHANGE" | null;
  gasStage?: "TO_STATION" | "AT_STATION" | null;
  restaurantName?: string;
  fulfillmentType?: "DELIVERY" | "PICKUP" | "SCHEDULED";
  total?: number;
};

/** Pickup: no courier — the customer collects and pays at the counter. */
function buildPickupSteps(orderStatus: FoodOrderStatus, info: CancelInfo): TrackingStep[] {
  const store = info.restaurantName || "the store";
  const defs = [
    { id: "placed", label: "Order placed", subtitle: `Sent to ${store}` },
    { id: "accepted", label: "Order accepted", subtitle: "The store confirmed your order" },
    { id: "preparing", label: "Being prepared", subtitle: "We'll tell you when it's ready" },
    { id: "ready", label: "Ready for pickup", subtitle: `Collect it at ${store}` },
    { id: "done", label: "Collected", subtitle: "Enjoy!" },
  ];
  const current =
    orderStatus === "DELIVERED"
      ? 5
      : orderStatus === "READY_FOR_PICKUP"
        ? 3
        : orderStatus === "PREPARING" || orderStatus === "CONFIRMED"
          ? 2
          : 0;
  return defs.map((step, index) => ({
    ...step,
    state: index < current ? "done" : index === current ? "active" : "pending",
  }));
}

type GasRide = { status?: string; gasLeg?: string | null } | null | undefined;

/**
 * Gas REFILL runs in the other direction first: the courier collects the empty from the
 * customer, the station fills it, then it comes back. These steps replace the store ones.
 */
function gasRefillStepIndex(orderStatus: FoodOrderStatus, ride: GasRide, info: CancelInfo) {
  if (orderStatus === "DELIVERED") return 7;
  if (orderStatus === "READY_FOR_PICKUP" || orderStatus === "PICKED_UP") return 5;
  if (info.gasStage === "AT_STATION") return 4;
  if (info.gasStage === "TO_STATION" || (ride?.gasLeg === "COLLECT" && ride.status === "IN_PROGRESS")) {
    return 3;
  }
  if (orderStatus === "PREPARING") return 2;
  return 0;
}

function buildGasRefillSteps(orderStatus: FoodOrderStatus, ride: GasRide, info: CancelInfo): TrackingStep[] {
  const station = info.restaurantName || "the gas station";
  const searching = ride?.gasLeg === "COLLECT" && ride.status === "SEARCHING_FOR_RIDER";
  const defs = [
    { id: "placed", label: "Request sent", subtitle: `Sent to ${station}` },
    { id: "accepted", label: "Station accepted", subtitle: "They'll fill your cylinder" },
    {
      id: "collect",
      label: searching ? "Finding a courier" : "Courier collecting your empty",
      subtitle: "Have your empty cylinder ready",
    },
    { id: "to_station", label: "Taking it to the station", subtitle: station },
    { id: "filling", label: "Filling your cylinder", subtitle: "The station is filling it now" },
    { id: "returning", label: "Bringing your gas back", subtitle: "Pay cash and share your code" },
    { id: "done", label: "Gas delivered", subtitle: "Enjoy your cooking" },
  ];
  const current = gasRefillStepIndex(orderStatus, ride, info);
  return defs.map((step, index) => ({
    ...step,
    state: index < current ? "done" : index === current ? "active" : "pending",
  }));
}

function gasRefillHero(orderStatus: FoodOrderStatus, ride: GasRide, info: CancelInfo) {
  const station = info.restaurantName || "The station";
  if (orderStatus === "PLACED" || orderStatus === "CONFIRMED") {
    return { title: "Confirming request", subtitle: "Waiting for the gas station to accept" };
  }
  if (ride?.gasLeg === "COLLECT") {
    if (ride.status === "SEARCHING_FOR_RIDER") {
      return { title: "Finding a courier", subtitle: "They'll collect your empty cylinder" };
    }
    if (ride.status === "START") {
      return { title: "Courier on the way", subtitle: "Have your empty cylinder ready" };
    }
    if (ride.status === "ARRIVED") {
      return { title: "Courier has arrived", subtitle: "Hand over your empty cylinder" };
    }
    if (ride.status === "IN_PROGRESS") {
      return { title: "On the way to the station", subtitle: "Your cylinder is with the courier" };
    }
  }
  if (orderStatus === "PREPARING") {
    return { title: "Filling your cylinder", subtitle: `${station} is filling it now` };
  }
  if (ride?.status === "IN_PROGRESS") {
    return { title: "Bringing your gas back", subtitle: "Pay cash and share your code on arrival" };
  }
  return { title: "Gas filled", subtitle: "The courier is collecting it from the station" };
}

/** Why the order was cancelled, from the customer's point of view. */
function cancelledSubtitle(c: ReturnType<typeof getCommerceOrderCopy>, info?: CancelInfo | null) {
  if (info?.cancelledBy === "CUSTOMER") return "You cancelled this order";
  return info?.cancelReason?.trim() || c.trackingCancelledStore;
}

/** What happens to the customer's money after a cancellation. */
export function cancelledMoneyNote(info?: CancelInfo | null): string {
  if (info?.refundStatus === "DUE") return "Your MoMo payment will be refunded";
  if (info?.refundStatus === "REFUNDED") return "Your MoMo payment has been refunded";
  return "You were not charged for this order";
}

export function buildFoodTrackingSteps(
  orderStatus: FoodOrderStatus,
  ride?: { status?: string; rider?: unknown } | null,
  vertical?: StoreVertical,
  cancelInfo?: CancelInfo | null
): TrackingStep[] {
  const v = vertical ?? "FOOD";
  const c = getCommerceOrderCopy(v);

  if (orderStatus === "CANCELLED") {
    return [
      {
        id: "cancelled",
        label: "Order cancelled",
        subtitle: cancelledSubtitle(c, cancelInfo),
        state: "active",
      },
    ];
  }
  if (cancelInfo?.gasMode === "REFILL") {
    return buildGasRefillSteps(orderStatus, ride as GasRide, cancelInfo);
  }
  if (cancelInfo?.fulfillmentType === "PICKUP") {
    return buildPickupSteps(orderStatus, cancelInfo);
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

/** Delivery code shown to customer when courier is assigned (until delivered). */
export function getFoodDeliveryCode(order: {
  deliveryCode?: string | null;
  ride?: { otp?: string; gasLeg?: string | null } | null;
}): string | null {
  // Gas collection leg: nothing is delivered to the customer yet, so no code to share.
  const code =
    order.deliveryCode || (order.ride?.gasLeg === "COLLECT" ? null : order.ride?.otp);
  return code && String(code).length >= 4 ? String(code) : null;
}

const FOOD_DELIVERY_CODE_RIDE_STATUSES = new Set([
  "START",
  "ARRIVED",
  "IN_PROGRESS",
]);

/** Show delivery code once a courier is assigned and en route (not while still searching). */
export function shouldShowFoodDeliveryCode(
  orderStatus: FoodOrderStatus,
  ride?: { status?: string; _id?: string } | null
): boolean {
  if (!ride?._id) return false;
  if (orderStatus === "DELIVERED" || orderStatus === "CANCELLED") return false;
  if (ride.status === "COMPLETED") return false;
  return FOOD_DELIVERY_CODE_RIDE_STATUSES.has(ride.status ?? "");
}

/** Live-ride sheet: same rule as order tracking (code ready from pickup through handoff). */
export function shouldShowFoodDeliveryCodeOnLiveRide(
  rideStatus?: string | null,
  otp?: string | null
): boolean {
  if (!otp || String(otp).length < 4) return false;
  return FOOD_DELIVERY_CODE_RIDE_STATUSES.has(rideStatus ?? "");
}

export function getHeroStatusLabel(
  orderStatus: FoodOrderStatus,
  ride?: { status?: string } | null,
  order?:
    | ({
        restaurant?: { vertical?: string };
        restaurantName?: string;
        vertical?: string;
        storeVertical?: string;
      } & CancelInfo)
    | null
): { title: string; subtitle: string } {
  const vertical = resolveOrderVertical(order ?? undefined);
  const c = getCommerceOrderCopy(vertical);

  if (orderStatus === "CANCELLED") {
    return { title: "Order cancelled", subtitle: cancelledMoneyNote(order) };
  }
  if (orderStatus === "DELIVERED" || (ride?.status === "COMPLETED" && order?.gasMode !== "REFILL")) {
    return {
      title: order?.fulfillmentType === "PICKUP" ? "Collected" : "Delivered",
      subtitle: c.customerEnjoyDelivered,
    };
  }
  if (order?.gasMode === "REFILL") {
    return gasRefillHero(orderStatus, ride as GasRide, order);
  }
  if (order?.fulfillmentType === "PICKUP") {
    if (orderStatus === "READY_FOR_PICKUP") {
      const pay = order.total != null ? `Pay ${formatCurrency(order.total)} at the counter` : "Pay at the counter";
      return { title: "Ready for pickup", subtitle: `${pay} · ${order.restaurantName || "the store"}` };
    }
  }
  if (ride?.status === "IN_PROGRESS") {
    return {
      title: "On the way",
      subtitle:
        order?.gasMode === "EXCHANGE"
          ? "Have your empty cylinder ready and share your code"
          : "Share your delivery code with the courier when they arrive",
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

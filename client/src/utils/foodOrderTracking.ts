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
    return { title: "Finding a courier", subtitle: "Hang tight — matching a driver" };
  }
  if (orderStatus === "READY_FOR_PICKUP") {
    return { title: "Ready for pickup", subtitle: "Waiting for a courier" };
  }
  if (orderStatus === "PREPARING") {
    return { title: c.trackingStoreCooking, subtitle: c.trackingPreparingHero };
  }
  return { title: c.trackingWaitingStore, subtitle: "They will confirm your order soon" };
}

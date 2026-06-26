import { parcelModeLabels, parseRideParcelMode, type ParcelMode } from "./parcelMode";
import { getCommerceOrderCopy } from "./commerceOrderCopy";
import { isFoodDelivery } from "./riderRideUtils";

type CourierRide = {
  serviceType?: string;
  parcelMode?: unknown;
  storeVertical?: string;
  status?: string;
  customer?: { name?: string; phone?: string };
  recipientName?: string;
  recipientPhone?: string;
};

export type RiderCourierUi = {
  meetLabel: string;
  contactPhone?: string;
  pickupLabel: string;
  dropLabel: string;
};

function parcelLabels(mode: ParcelMode) {
  const labels = parcelModeLabels(mode);
  return {
    pickupLabel: labels.riderPickupLabel,
    dropLabel: labels.riderDropLabel,
  };
}

export function getRiderCourierUi(ride?: CourierRide | null): RiderCourierUi {
  const status = ride?.status;
  const labels = parcelLabels(parseRideParcelMode(ride));

  if (isFoodDelivery(ride)) {
    const c = getCommerceOrderCopy(ride?.storeVertical);
    const enRouteToCustomer = status === "ARRIVED" || status === "IN_PROGRESS";
    return {
      meetLabel: enRouteToCustomer ? "Meet the customer" : c.riderMeetAtPickup,
      contactPhone: ride?.customer?.phone,
      pickupLabel: c.riderPickupLabel,
      dropLabel: "Customer",
    };
  }

  if (ride?.serviceType === "DELIVERY") {
    const mode = parseRideParcelMode(ride);

    if (status === "START") {
      return {
        meetLabel:
          mode === "RECEIVE"
            ? "Collect parcel from sender"
            : "Collect from sender",
        contactPhone: ride?.customer?.phone,
        ...labels,
      };
    }

    if (status === "ARRIVED") {
      return {
        meetLabel:
          mode === "RECEIVE"
            ? "Next: deliver to customer"
            : "Next: deliver to recipient",
        contactPhone: ride?.recipientPhone || ride?.customer?.phone,
        ...labels,
      };
    }

    if (status === "IN_PROGRESS") {
      return {
        meetLabel: mode === "RECEIVE" ? "Meet the customer" : "Meet the recipient",
        contactPhone: ride?.recipientPhone || ride?.customer?.phone,
        ...labels,
      };
    }

    return {
      meetLabel: "Parcel delivery",
      contactPhone: ride?.customer?.phone,
      ...labels,
    };
  }

  return {
    meetLabel: "Meet the customer",
    contactPhone: ride?.customer?.phone,
    pickupLabel: "Pickup",
    dropLabel: "Drop",
  };
}

export function getRiderSwipeTitle(ride?: CourierRide | null): string {
  const status = ride?.status;
  const isFood = isFoodDelivery(ride);
  const isParcel = ride?.serviceType === "DELIVERY";

  if (status === "START") {
    if (isFood) return "Confirm pickup";
    if (isParcel) return "Confirm collection";
    return "Confirm arrival";
  }
  if (status === "ARRIVED") {
    if (isFood) return "Start delivery";
    if (isParcel) return "Start delivery";
    return "Start ride";
  }
  if (status === "IN_PROGRESS") {
    if (isFood || isParcel) return "Confirm delivery";
    return "Complete ride";
  }
  return "Continue";
}

export type RiderDeliveryPhase = {
  step: number;
  totalSteps: number;
  phaseLabel: string;
  phaseHint: string;
  accentColor: string;
  swipeColor: string;
};

export function getRiderDeliveryPhase(ride?: CourierRide | null): RiderDeliveryPhase {
  const status = ride?.status;
  const isFood = isFoodDelivery(ride);
  const isParcel = ride?.serviceType === "DELIVERY";
  const parcelMode = parseRideParcelMode(ride);

  if (status === "START") {
    return {
      step: 1,
      totalSteps: 3,
      phaseLabel: isFood ? "Collect order" : isParcel ? "Collect parcel" : "Go to pickup",
      phaseHint: isFood ? "Head to the restaurant and confirm when you have the order" : "Navigate to the pickup point",
      accentColor: "#f97316",
      swipeColor: "#ea580c",
    };
  }
  if (status === "ARRIVED") {
    return {
      step: 2,
      totalSteps: 3,
      phaseLabel: isFood
        ? "Deliver to customer"
        : isParcel
          ? parcelMode === "RECEIVE"
            ? "Heading to customer"
            : "Heading to recipient"
          : "Passenger pickup",
      phaseHint: isFood
        ? "Start heading to the customer's address"
        : isParcel
          ? parcelMode === "RECEIVE"
            ? "Start heading to the customer address"
            : "Start heading to the recipient address"
          : "Begin the trip with your passenger",
      accentColor: "#0ea5e9",
      swipeColor: "#0284c7",
    };
  }
  if (status === "IN_PROGRESS") {
    return {
      step: 3,
      totalSteps: 3,
      phaseLabel: isFood || isParcel ? "Complete delivery" : "Finish trip",
      phaseHint: isFood
        ? "Ask the customer for their 4-digit code before handing over"
        : isParcel
          ? "Enter the recipient's delivery code to finish"
          : "Swipe when you've reached the destination",
      accentColor: "#16a34a",
      swipeColor: "#15803d",
    };
  }
  return {
    step: 1,
    totalSteps: 3,
    phaseLabel: "Delivery",
    phaseHint: "Loading trip details…",
    accentColor: "#64748b",
    swipeColor: "#475569",
  };
}

export function getRiderParcelCollectedAlert(mode: ParcelMode): { title: string; message: string } {
  if (mode === "RECEIVE") {
    return {
      title: "Parcel collected",
      message: "Check the package, then head to the customer at the drop-off address.",
    };
  }
  return {
    title: "Parcel collected",
    message: "Confirm the package matches the photo, then head to the recipient.",
  };
}

export function getRiderParcelDeliveryStartedAlert(mode: ParcelMode): { title: string; message: string } {
  if (mode === "RECEIVE") {
    return {
      title: "On the way",
      message: "Deliver to the customer. They will share their delivery code at handoff.",
    };
  }
  return {
    title: "On the way",
    message: "Head to the recipient with the parcel.",
  };
}

export function getRiderParcelOtpSubtitle(mode: ParcelMode): string {
  if (mode === "RECEIVE") {
    return "Ask the customer for their 4-digit delivery code before handing over the parcel.";
  }
  return "Ask the recipient for their 4-digit delivery code before handing over the parcel.";
}

export function getRiderParcelOtpError(mode: ParcelMode): string {
  if (mode === "RECEIVE") {
    return "Ask the customer for the correct 4-digit delivery code.";
  }
  return "Ask the recipient for the correct 4-digit delivery code.";
}

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
            ? "Collect parcel at pickup"
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
    if (isFood) return "PICKED UP";
    if (isParcel) return "COLLECTED";
    return "ARRIVED";
  }
  if (status === "ARRIVED") {
    if (isFood) return "HEADING TO CUSTOMER";
    if (isParcel) return "START DELIVERY";
    return "START RIDE";
  }
  if (status === "IN_PROGRESS") {
    if (isFood || isParcel) return "DELIVERED";
    return "COMPLETED";
  }
  return "SUCCESS";
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

import { parcelModeLabels, parseRideParcelMode, type ParcelMode } from "./parcelMode";
import { getCommerceOrderCopy } from "./commerceOrderCopy";

type TrackingRide = {
  serviceType?: string;
  parcelMode?: unknown;
  status?: string;
  recipientName?: string;
};

export function getCustomerParcelStatus(
  mode: ParcelMode,
  status: string,
  recipientName?: string
): { title: string; subtitle: string } {
  if (status === "START") {
    if (mode === "RECEIVE") {
      return {
        title: "Courier heading to pickup",
        subtitle: "Collecting your parcel from the pickup address",
      };
    }
    return {
      title: "Courier heading to you",
      subtitle: "They'll pick up your parcel from you",
    };
  }

  if (status === "ARRIVED") {
    if (mode === "RECEIVE") {
      return {
        title: "Parcel collected",
        subtitle: "Courier will bring it to you shortly",
      };
    }
    return {
      title: "Parcel collected",
      subtitle: recipientName
        ? `Next stop: ${recipientName}`
        : "Courier will deliver to your recipient",
    };
  }

  if (status === "IN_PROGRESS") {
    if (mode === "RECEIVE") {
      return {
        title: "Courier on the way to you",
        subtitle: "Your parcel is heading to your address",
      };
    }
    return {
      title: "Delivering to recipient",
      subtitle: recipientName
        ? `On the way to ${recipientName}`
        : "Courier is heading to the drop-off address",
    };
  }

  return { title: "Parcel delivery", subtitle: "In progress" };
}

export function getCustomerRiderMapStatus(
  mode: ParcelMode,
  status: string,
  serviceType?: string,
  storeVertical?: string
): string {
  const isParcel = serviceType === "DELIVERY";
  const isFood = serviceType === "FOOD";

  if (isFood) {
    const c = getCommerceOrderCopy(storeVertical);
    if (status === "START") return c.riderHeadingToPickup;
    if (status === "ARRIVED") return c.riderAtPickup;
    if (status === "IN_PROGRESS") return "Delivering your order";
    return "On the way";
  }

  if (isParcel) {
    if (status === "START") {
      return mode === "RECEIVE" ? "Heading to collect parcel" : "Heading to you";
    }
    if (status === "ARRIVED") {
      return mode === "RECEIVE" ? "Parcel collected" : "Parcel collected from you";
    }
    if (status === "IN_PROGRESS") {
      return mode === "RECEIVE" ? "Bringing parcel to you" : "Delivering to recipient";
    }
    return "On the way";
  }

  if (status === "START") return "Heading to pickup";
  if (status === "ARRIVED") return "At pickup location";
  if (status === "IN_PROGRESS") return "On the way to destination";
  return "On the way";
}

export function getCustomerRouteLabels(ride?: TrackingRide | null) {
  if (ride?.serviceType === "DELIVERY") {
    const labels = parcelModeLabels(parseRideParcelMode(ride));
    return {
      pickupLabel: labels.routePickup,
      dropLabel: labels.routeDrop,
    };
  }
  return { pickupLabel: "Pickup", dropLabel: "Destination" };
}

export type ParcelMode = "SEND" | "RECEIVE";

export function parseParcelMode(value: unknown): ParcelMode {
  return value === "RECEIVE" ? "RECEIVE" : "SEND";
}

export function getTripTypeBadge(trip: {
  serviceType?: string;
  parcelMode?: unknown;
}): { label: string; className: string } {
  if (trip.serviceType === "DELIVERY") {
    const mode = parseParcelMode(trip.parcelMode);
    if (mode === "RECEIVE") {
      return { label: "Receive", className: "bg-violet-100 text-violet-800" };
    }
    return { label: "Send", className: "bg-purple-100 text-purple-800" };
  }
  return { label: "Ride", className: "bg-blue-100 text-blue-800" };
}

export function parcelAdminLabels(mode: ParcelMode) {
  if (mode === "RECEIVE") {
    return {
      direction: "Receive parcel",
      pickupLabel: "Collect from",
      dropLabel: "Deliver to customer",
      recipientLabel: "Customer (recipient)",
    };
  }
  return {
    direction: "Send parcel",
    pickupLabel: "Pickup",
    dropLabel: "Recipient",
    recipientLabel: "Recipient",
  };
}

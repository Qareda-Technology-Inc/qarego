export type ParcelMode = "SEND" | "RECEIVE";

export function parseParcelMode(value: unknown): ParcelMode {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "RECEIVE" ? "RECEIVE" : "SEND";
}

export function parcelModeLabels(mode: ParcelMode) {
  if (mode === "RECEIVE") {
    return {
      title: "Receive a parcel",
      subtitle: "Collect from anywhere → deliver to you",
      pickupLabel: "Collect from",
      dropLabel: "Deliver to me",
      pickupPlaceholder: "Shop, sender, or pickup address",
      dropPlaceholder: "Your delivery address",
      bookingTitle: "Receive parcel",
      bookingSubtitle: "A courier will collect the package and bring it to you",
      recipientSection: "Your details",
      recipientHint: "We'll deliver to this name and number",
      recipientNamePlaceholder: "Your name",
      recipientPhonePlaceholder: "Your phone number",
      photoHint: "Optional photo of what we're collecting",
      routePickup: "Collect from",
      routeDrop: "Deliver to me",
      confirmCta: "Receive parcel",
      riderBadge: "Receive parcel",
      riderPickupLabel: "Collect from",
      riderDropLabel: "Customer",
      deliveryCodeHint:
        "Give this code to the courier when they arrive with your parcel.",
      searchingHint: "Collect and deliver to you",
    };
  }

  return {
    title: "Send a parcel",
    subtitle: "Pickup from you → deliver to someone else",
    pickupLabel: "Pickup",
    dropLabel: "Recipient",
    pickupPlaceholder: "Your pickup point",
    dropPlaceholder: "Recipient address",
    bookingTitle: "Send parcel",
    bookingSubtitle: "You are the sender — courier collects here and delivers to your recipient",
    recipientSection: "Recipient",
    recipientHint: "Who will receive the parcel at drop-off?",
    recipientNamePlaceholder: "Recipient name",
    recipientPhonePlaceholder: "Recipient phone",
    photoHint: "Help your courier identify the parcel at pickup",
    routePickup: "Pickup",
    routeDrop: "Recipient",
    confirmCta: "Send parcel",
    riderBadge: "Send parcel",
    riderPickupLabel: "Pickup",
    riderDropLabel: "Recipient",
    deliveryCodeHint:
      "Share with your recipient. The courier needs this code to complete delivery.",
    searchingHint: "Deliver to recipient",
  };
}

export function parseRideParcelMode(ride?: { parcelMode?: unknown; serviceType?: string } | null): ParcelMode {
  if (ride?.serviceType !== "DELIVERY") return "SEND";
  return parseParcelMode(ride?.parcelMode);
}

import { Alert } from "react-native";
import { router } from "expo-router";

/**
 * Booking refused because a mobile money trip is unpaid: offer to pay it now.
 * Returns true when the error was this one (and the alert was shown).
 */
export function handleUnpaidRideError(error: any): boolean {
  const data = error?.response?.data;
  if (data?.code !== "UNPAID_RIDE" || !data?.unpaidRide?.rideId) return false;
  Alert.alert("Pay for your last trip first", data.msg, [
    { text: "Later", style: "cancel" },
    {
      text: "Pay now",
      onPress: () =>
        router.navigate({ pathname: "/customer/liveride", params: { id: data.unpaidRide.rideId } }),
    },
  ]);
  return true;
}

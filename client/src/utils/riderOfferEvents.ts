import { DeviceEventEmitter } from "react-native";

export const RIDER_OFFER_ACCEPTED = "rider:offer-accepted";

export function emitRiderOfferAccepted() {
  DeviceEventEmitter.emit(RIDER_OFFER_ACCEPTED);
}

export function onRiderOfferAccepted(listener: () => void) {
  const sub = DeviceEventEmitter.addListener(RIDER_OFFER_ACCEPTED, listener);
  return () => sub.remove();
}

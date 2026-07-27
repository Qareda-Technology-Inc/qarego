import { Alert, Linking, Platform } from "react-native";

export type MapPoint = {
  address?: string;
  latitude?: number;
  longitude?: number;
};

export function openMapsToPoint(point: MapPoint, label: string) {
  const lat = Number(point.latitude);
  const lng = Number(point.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    Alert.alert("Location unavailable", `Could not open ${label.toLowerCase()} in maps.`);
    return;
  }
  const googleMapsUrl = Platform.select({
    ios: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
    android: `google.navigation:q=${lat},${lng}`,
  });
  const appleMapsUrl = `maps://app?daddr=${lat},${lng}&directionsmode=driving`;
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

  if (Platform.OS === "ios") {
    Linking.canOpenURL(googleMapsUrl || webUrl)
      .then((ok) =>
        ok
          ? Linking.openURL(googleMapsUrl || webUrl)
          : Linking.openURL(appleMapsUrl).catch(() => Linking.openURL(webUrl))
      )
      .catch(() => Linking.openURL(webUrl));
    return;
  }
  Linking.canOpenURL(googleMapsUrl || webUrl)
    .then((ok) => Linking.openURL(ok ? (googleMapsUrl || webUrl) : webUrl))
    .catch(() => Linking.openURL(webUrl));
}

export function openMapsRoute(pickup: MapPoint, drop: MapPoint) {
  const sLat = Number(pickup.latitude);
  const sLng = Number(pickup.longitude);
  const dLat = Number(drop.latitude);
  const dLng = Number(drop.longitude);
  if (![sLat, sLng, dLat, dLng].every(Number.isFinite)) {
    Alert.alert("Route unavailable", "Pickup or destination coordinates are missing.");
    return;
  }
  const googleMapsUrl = Platform.select({
    ios: `comgooglemaps://?saddr=${sLat},${sLng}&daddr=${dLat},${dLng}&directionsmode=driving`,
    android: `google.navigation:q=${dLat},${dLng}`,
  });
  const appleMapsUrl = `maps://app?saddr=${sLat},${sLng}&daddr=${dLat},${dLng}&dirflg=d`;
  const webUrl = `https://www.google.com/maps/dir/?api=1&origin=${sLat},${sLng}&destination=${dLat},${dLng}&travelmode=driving`;

  if (Platform.OS === "ios") {
    Linking.canOpenURL(googleMapsUrl || webUrl)
      .then((ok) =>
        ok
          ? Linking.openURL(googleMapsUrl || webUrl)
          : Linking.openURL(appleMapsUrl).catch(() => Linking.openURL(webUrl))
      )
      .catch(() => Linking.openURL(webUrl));
    return;
  }
  Linking.canOpenURL(googleMapsUrl || webUrl)
    .then((ok) => Linking.openURL(ok ? (googleMapsUrl || webUrl) : webUrl))
    .catch(() => Linking.openURL(webUrl));
}

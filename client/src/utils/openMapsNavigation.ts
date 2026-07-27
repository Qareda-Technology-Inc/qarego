import { Alert, Linking, Platform } from "react-native";

export type MapPoint = {
  address?: string;
  latitude?: number;
  longitude?: number;
};

function openUrlPreferGoogle(opts: {
  googleNative?: string | null;
  appleMaps?: string | null;
  webUrl: string;
}) {
  const { googleNative, appleMaps, webUrl } = opts;
  if (Platform.OS === "ios") {
    const candidate = googleNative || webUrl;
    Linking.canOpenURL(candidate)
      .then((ok) =>
        ok && googleNative
          ? Linking.openURL(googleNative)
          : Linking.openURL(appleMaps || webUrl).catch(() => Linking.openURL(webUrl))
      )
      .catch(() => Linking.openURL(webUrl));
    return;
  }
  const candidate = googleNative || webUrl;
  Linking.canOpenURL(candidate)
    .then((ok) => Linking.openURL(ok && googleNative ? googleNative : webUrl))
    .catch(() => Linking.openURL(webUrl));
}

export function openMapsToPoint(point: MapPoint, label: string) {
  const lat = Number(point.latitude);
  const lng = Number(point.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    Alert.alert("Location unavailable", `Could not open ${label.toLowerCase()} in maps.`);
    return;
  }
  const googleNative = Platform.select({
    ios: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
    // Prefer directions URL over google.navigation so callers can fall back cleanly.
    android: `google.navigation:q=${lat},${lng}`,
  });
  const appleMaps = `maps://app?daddr=${lat},${lng}&directionsmode=driving`;
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

  openUrlPreferGoogle({ googleNative, appleMaps, webUrl });
}

/** Open turn-by-turn for a full A→B route (pickup → drop). */
export function openMapsRoute(pickup: MapPoint, drop: MapPoint) {
  const sLat = Number(pickup.latitude);
  const sLng = Number(pickup.longitude);
  const dLat = Number(drop.latitude);
  const dLng = Number(drop.longitude);
  if (![sLat, sLng, dLat, dLng].every(Number.isFinite)) {
    Alert.alert("Route unavailable", "Pickup or destination coordinates are missing.");
    return;
  }
  const googleNative = Platform.select({
    ios: `comgooglemaps://?saddr=${sLat},${sLng}&daddr=${dLat},${dLng}&directionsmode=driving`,
    // Android Intent with both origin and destination (not drop-only navigation).
    android: `https://www.google.com/maps/dir/?api=1&origin=${sLat},${sLng}&destination=${dLat},${dLng}&travelmode=driving`,
  });
  const appleMaps = `maps://app?saddr=${sLat},${sLng}&daddr=${dLat},${dLng}&dirflg=d`;
  const webUrl = `https://www.google.com/maps/dir/?api=1&origin=${sLat},${sLng}&destination=${dLat},${dLng}&travelmode=driving`;

  openUrlPreferGoogle({ googleNative, appleMaps, webUrl });
}

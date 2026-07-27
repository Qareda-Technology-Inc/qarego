/** Helpers for Google Directions — avoid ZERO_RESULTS on impossible / simulator routes */

export type MapCoord = { latitude: number; longitude: number };

export function parseMapCoord(point: unknown): MapCoord | null {
  if (!point || typeof point !== "object") return null;
  const p = point as { latitude?: unknown; longitude?: unknown };
  const latitude = Number(p.latitude);
  const longitude = Number(p.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

/** Stable string key for map coord deps — avoids re-render loops from new object refs. */
export function coordKey(point: unknown): string {
  if (!point || typeof point !== "object") return "";
  const p = point as { latitude?: unknown; longitude?: unknown };
  const lat = Number(p.latitude);
  const lng = Number(p.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  return `${lat},${lng}`;
}

export function distanceKm(a: MapCoord, b: MapCoord): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Driving directions only work for reasonably close points (same region). */
export function canRequestDrivingRoute(
  origin: MapCoord,
  destination: MapCoord,
  maxKm = 150
): boolean {
  const km = distanceKm(origin, destination);
  return km > 0.02 && km <= maxKm;
}

export function isDirectionsZeroResults(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? error ?? "");
  return msg.includes("ZERO_RESULTS");
}

export function riderNearRoute(
  rider: MapCoord | null,
  pickup: MapCoord | null,
  drop: MapCoord | null,
  maxKm = 150
): boolean {
  if (!rider) return false;
  if (pickup && canRequestDrivingRoute(rider, pickup, maxKm)) return true;
  if (drop && canRequestDrivingRoute(rider, drop, maxKm)) return true;
  return false;
}

/** Decode Google's encoded polyline string into lat/lng points. */
export function decodePolyline(encoded: string): MapCoord[] {
  const points: MapCoord[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}

/** Fetch driving route coordinates without mounting MapViewDirections (avoids iOS map crashes). */
export async function fetchDrivingPolyline(
  origin: MapCoord,
  destination: MapCoord,
  apiKey: string
): Promise<MapCoord[] | null> {
  if (!apiKey || !canRequestDrivingRoute(origin, destination)) return null;
  try {
    const url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${origin.latitude},${origin.longitude}` +
      `&destination=${destination.latitude},${destination.longitude}` +
      `&mode=driving&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data?.status === "ZERO_RESULTS") return null;
    const encoded = data?.routes?.[0]?.overview_polyline?.points;
    if (!encoded) return null;
    const coords = decodePolyline(encoded);
    return coords.length >= 2 ? coords : null;
  } catch {
    return null;
  }
}

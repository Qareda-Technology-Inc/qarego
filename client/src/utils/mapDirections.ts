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

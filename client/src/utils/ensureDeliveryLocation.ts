import { reverseGeocode } from "@/utils/mapUtils";
import { getCurrentLocationAsync } from "@/utils/locationUtils";

export type UserLocation = {
  latitude: number;
  longitude: number;
  address: string;
} | null;

/**
 * Ensures userStore has a delivery point from GPS + reverse geocode (same as home map).
 * Reuses existing coords when already set; only geocodes if address text is missing.
 */
export async function ensureUserDeliveryLocation(
  current: UserLocation,
  setLocation: (loc: UserLocation) => void
): Promise<{ ok: true } | { ok: false; message: string; canOpenSettings?: boolean }> {
  if (hasValidDeliveryCoords(current) && (current?.address?.trim()?.length ?? 0) > 0) {
    return { ok: true };
  }

  let latitude = current?.latitude;
  let longitude = current?.longitude;
  let address = current?.address?.trim() ?? "";

  if (latitude == null || longitude == null || Number.isNaN(Number(latitude))) {
    const gps = await getCurrentLocationAsync();
    if (!gps.ok) {
      return {
        ok: false,
        message: gps.message,
        canOpenSettings: gps.canOpenSettings,
      };
    }
    latitude = gps.latitude;
    longitude = gps.longitude;
  }

  if (!address) {
    const geocoded = await reverseGeocode(latitude, longitude);
    address = geocoded?.trim() || "Your current location";
  }

  setLocation({ latitude, longitude, address });
  return { ok: true };
}

export function hasValidDeliveryCoords(loc: UserLocation): boolean {
  if (loc?.latitude == null || loc?.longitude == null) return false;
  return Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude));
}

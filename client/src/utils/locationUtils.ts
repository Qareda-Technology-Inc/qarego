import * as Location from "expo-location";

export type GetLocationResult =
  | { ok: true; latitude: number; longitude: number; heading?: number }
  | { ok: false; message: string; canOpenSettings?: boolean };

const DEFAULT_MESSAGE =
  "Location is unavailable. Please enable location services and try again.";

const DEFAULT_TIMEOUT_MS = 12_000;

function coordsFromPosition(
  location: Location.LocationObject
): { latitude: number; longitude: number; heading?: number } {
  const { latitude, longitude } = location.coords;
  const heading = location.coords.heading ?? undefined;
  return { latitude, longitude, heading };
}

function mapLocationError(error: unknown): GetLocationResult {
  const msg =
    error instanceof Error ? error.message?.toLowerCase?.() || "" : "";
  let message = DEFAULT_MESSAGE;
  let canOpenSettings = true;

  if (msg.includes("permission") || msg.includes("denied")) {
    message = "Location permission is required. Please allow access in settings.";
  } else if (msg.includes("unavailable") || msg.includes("disabled")) {
    message =
      "Location is unavailable. Make sure location services are enabled in your device settings.";
  } else if (msg.includes("timeout") || msg.includes("could not find")) {
    message =
      "Could not get your location in time. Try again near a window or enable GPS.";
    canOpenSettings = false;
  }

  return { ok: false, message, canOpenSettings };
}

/**
 * Get current device location with timeout (avoids hung on-duty toggle).
 * Uses last-known position first when allowed for a fast on-duty path.
 */
export async function getCurrentLocationAsync(options?: {
  requestPermission?: boolean;
  timeoutMs?: number;
  /** Use recent cached GPS first (default true). */
  preferLastKnown?: boolean;
  maxAgeMs?: number;
}): Promise<GetLocationResult> {
  const requestPermission = options?.requestPermission !== false;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const preferLastKnown = options?.preferLastKnown !== false;
  const maxAgeMs = options?.maxAgeMs ?? 120_000;

  try {
    if (requestPermission) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        return {
          ok: false,
          message: "Location permission is required. Please allow access in settings.",
          canOpenSettings: true,
        };
      }
    }

    if (preferLastKnown) {
      try {
        const last = await Location.getLastKnownPositionAsync({ maxAge: maxAgeMs });
        if (last?.coords?.latitude != null && last?.coords?.longitude != null) {
          return { ok: true, ...coordsFromPosition(last) };
        }
      } catch {
        /* fall through to fresh fix */
      }
    }

    const location = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Location timeout")), timeoutMs);
      }),
    ]);

    return { ok: true, ...coordsFromPosition(location) };
  } catch (error) {
    return mapLocationError(error);
  }
}

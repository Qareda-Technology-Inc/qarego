import * as Device from "expo-device";
import * as Location from "expo-location";
import { Platform } from "react-native";

export type GetLocationResult =
  | { ok: true; latitude: number; longitude: number; heading?: number }
  | { ok: false; message: string; canOpenSettings?: boolean };

const DEFAULT_MESSAGE =
  "Location is unavailable. Please enable location services and try again.";

const DEFAULT_TIMEOUT_MS = 12_000;
const EMULATOR_ATTEMPT_TIMEOUT_MS = 12_000;
const LAST_KNOWN_MAX_AGE_MS = 2 * 60_000;
const LAST_KNOWN_MIN_ACCURACY_M = 200;

function isAndroidEmulator(): boolean {
  return Platform.OS === "android" && !Device.isDevice;
}

export function isAndroidEmulatorDevice(): boolean {
  return isAndroidEmulator();
}

function coordsFromPosition(
  location: Location.LocationObject
): { latitude: number; longitude: number; heading?: number } {
  const { latitude, longitude } = location.coords;
  const heading = location.coords.heading ?? undefined;
  return { latitude, longitude, heading };
}

function hasValidCoords(location: Location.LocationObject | null): boolean {
  const lat = location?.coords?.latitude;
  const lng = location?.coords?.longitude;
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
}

function mapLocationError(error: unknown, emulator: boolean): GetLocationResult {
  const msg =
    error instanceof Error ? error.message?.toLowerCase?.() || "" : "";
  let message = DEFAULT_MESSAGE;
  let canOpenSettings = true;

  if (msg.includes("permission") || msg.includes("denied")) {
    message = "Location permission is required. Please allow access in settings.";
  } else if (msg.includes("unavailable") || msg.includes("disabled")) {
    message = "Location is unavailable. Turn on location in your device settings, or enter an address.";
  } else if (msg.includes("timeout") || msg.includes("could not find")) {
    message = "We couldn't find your location in time. Try again, or enter an address.";
    canOpenSettings = false;
  }

  return { ok: false, message, canOpenSettings };
}

async function ensureLocationServicesEnabled(
  emulator: boolean
): Promise<GetLocationResult | null> {
  const enabled = await Location.hasServicesEnabledAsync();
  if (enabled) return null;

  if (Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
      if (await Location.hasServicesEnabledAsync()) return null;
    } catch {
      /* user dismissed system dialog */
    }
  }

  return {
    ok: false,
    message: "Location is off. Turn it on in your device settings, or enter an address.",
    canOpenSettings: true,
  };
}

/**
 * Check before asking: on some Android versions the request call never
 * resolves when permission is already granted, which froze callers.
 */
export async function ensureForegroundPermission(): Promise<Location.PermissionStatus> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === "granted" || !current.canAskAgain) return current.status;
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status;
}

async function fetchFreshPosition(timeoutMs: number): Promise<Location.LocationObject> {
  const accuracy =
    Platform.OS === "android"
      ? Location.Accuracy.Balanced
      : Location.Accuracy.Low;

  return Promise.race([
    Location.getCurrentPositionAsync({ accuracy }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Location timeout")), timeoutMs);
    }),
  ]);
}

/**
 * Get current device location with timeout (avoids hung on-duty toggle).
 * On Android emulators, reads mock GPS from Extended controls → Location.
 */
export async function getCurrentLocationAsync(options?: {
  requestPermission?: boolean;
  timeoutMs?: number;
  /** Use recent cached GPS first (default true on device, false on Android emulator). */
  preferLastKnown?: boolean;
  maxAgeMs?: number;
}): Promise<GetLocationResult> {
  const emulator = isAndroidEmulator();
  const requestPermission = options?.requestPermission !== false;
  const timeoutMs = emulator
    ? EMULATOR_ATTEMPT_TIMEOUT_MS
    : options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const preferLastKnown = emulator
    ? false
    : options?.preferLastKnown ?? true;
  const maxAgeMs = options?.maxAgeMs ?? (emulator ? 5_000 : 120_000);

  try {
    if (requestPermission) {
      const status = await ensureForegroundPermission();
      if (status !== "granted") {
        return {
          ok: false,
          message: "Location permission is required. Please allow access in settings.",
          canOpenSettings: true,
        };
      }
    }

    const services = await ensureLocationServicesEnabled(emulator);
    if (services) return services;

    if (preferLastKnown) {
      try {
        const last = await Location.getLastKnownPositionAsync({ maxAge: maxAgeMs });
        if (hasValidCoords(last)) {
          return { ok: true, ...coordsFromPosition(last!) };
        }
      } catch {
        /* fall through to fresh fix */
      }
    }

    try {
      const location = await fetchFreshPosition(timeoutMs);
      return { ok: true, ...coordsFromPosition(location) };
    } catch (firstError) {
      // No fresh fix in time: a position from the last couple of minutes beats an empty
      // pickup. Anything older may be somewhere else entirely, so it is not used.
      const last = await Location.getLastKnownPositionAsync({
        maxAge: LAST_KNOWN_MAX_AGE_MS,
        requiredAccuracy: LAST_KNOWN_MIN_ACCURACY_M,
      }).catch(() => null);
      if (hasValidCoords(last)) return { ok: true, ...coordsFromPosition(last!) };
      if (!emulator) throw firstError;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const location = await fetchFreshPosition(timeoutMs);
      return { ok: true, ...coordsFromPosition(location) };
    }
  } catch (error) {
    return mapLocationError(error, emulator);
  }
}

export type ServiceKey = "RIDE" | "DELIVERY" | "FOOD";

export type ServicePresetId =
  | "all"
  | "ride_only"
  | "delivery_only"
  | "parcel_only"
  | "food_only"
  | "custom";

export type ServiceSchedule = {
  useSchedule?: boolean;
  start?: string;
  end?: string;
};

export type ServicePreferenceEntry = {
  enabled?: boolean;
  schedule?: ServiceSchedule;
};

export type RiderServiceSettingsResponse = {
  servicePreset?: ServicePresetId;
  servicePreferences?: Record<ServiceKey, ServicePreferenceEntry>;
  manualPreferences?: Record<ServiceKey, boolean>;
  effectivePreferences?: Record<ServiceKey, boolean>;
  vehicleCategory?: string;
  vehicleSupportedServices?: ServiceKey[];
};

export const PRESET_OPTIONS: {
  id: ServicePresetId;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    id: "all",
    title: "All services",
    description: "Rides, parcels, and food (when your vehicle allows)",
    icon: "layers-outline",
  },
  {
    id: "ride_only",
    title: "Rides only",
    description: "Passenger bookings — no deliveries",
    icon: "car-outline",
  },
  {
    id: "delivery_only",
    title: "Delivery mode",
    description: "Parcels and food — no passenger rides",
    icon: "bicycle-outline",
  },
  {
    id: "parcel_only",
    title: "Parcels only",
    description: "Courier deliveries without food",
    icon: "cube-outline",
  },
  {
    id: "food_only",
    title: "Food only",
    description: "Restaurant pickups to customers",
    icon: "restaurant-outline",
  },
];

export const SERVICE_ROWS: {
  key: ServiceKey;
  label: string;
  description: string;
}[] = [
  { key: "RIDE", label: "Rides", description: "Passenger trips" },
  { key: "DELIVERY", label: "Parcels", description: "Courier / package delivery" },
  { key: "FOOD", label: "Food", description: "Restaurant to customer" },
];

export function vehicleLabel(category?: string): string {
  const c = (category || "motorcycle").toLowerCase();
  if (c === "pragya") return "Pragya";
  if (c === "comfort") return "Comfort";
  return "Motorcycle";
}

export function formatActiveModeLabel(
  effective?: Record<ServiceKey, boolean> | null
): string {
  if (!effective) return "All services";
  const on: string[] = [];
  if (effective.RIDE) on.push("Rides");
  if (effective.DELIVERY) on.push("Parcels");
  if (effective.FOOD) on.push("Food");
  if (!on.length) return "No services active";
  return on.join(" · ");
}

export function isServiceAllowedByVehicle(
  key: ServiceKey,
  supported?: ServiceKey[]
): boolean {
  if (!supported?.length) return true;
  return supported.includes(key);
}

function parseTimeToMinutes(hhmm?: string): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (m || 0);
}

function isWithinSchedule(schedule?: ServiceSchedule, now = new Date()): boolean {
  if (!schedule?.useSchedule) return true;
  const start = parseTimeToMinutes(schedule.start);
  const end = parseTimeToMinutes(schedule.end);
  if (start == null || end == null) return true;
  const mins = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  if (start < end) return mins >= start && mins <= end;
  return mins >= start || mins <= end;
}

/** Effective availability from stored user (for header chip). */
export function getEffectivePreferencesFromUser(
  user: { driverDetails?: { servicePreferences?: Record<ServiceKey, ServicePreferenceEntry> } } | null
): Record<ServiceKey, boolean> {
  const prefs = user?.driverDetails?.servicePreferences || {};
  return {
    RIDE: (prefs.RIDE?.enabled !== false) && isWithinSchedule(prefs.RIDE?.schedule),
    DELIVERY:
      (prefs.DELIVERY?.enabled !== false) && isWithinSchedule(prefs.DELIVERY?.schedule),
    FOOD: (prefs.FOOD?.enabled !== false) && isWithinSchedule(prefs.FOOD?.schedule),
  };
}

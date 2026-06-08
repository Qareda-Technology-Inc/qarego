const SERVICE_TYPES = ["RIDE", "DELIVERY", "FOOD"];
export { SERVICE_TYPES };

/** Quick presets riders can apply in the app. */
export const SERVICE_PRESETS = {
  all: { RIDE: true, DELIVERY: true, FOOD: true },
  ride_only: { RIDE: true, DELIVERY: false, FOOD: false },
  delivery_only: { RIDE: false, DELIVERY: true, FOOD: true },
  parcel_only: { RIDE: false, DELIVERY: true, FOOD: false },
  food_only: { RIDE: false, DELIVERY: false, FOOD: true },
};

export const PRESET_IDS = Object.keys(SERVICE_PRESETS);

export function parseTimeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return null;
  const parts = hhmm.trim().split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(m) || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

export function isWithinSchedule(schedule, now = new Date()) {
  if (!schedule?.useSchedule) return true;
  const start = parseTimeToMinutes(schedule.start);
  const end = parseTimeToMinutes(schedule.end);
  if (start == null || end == null) return true;
  const mins = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  if (start < end) return mins >= start && mins <= end;
  return mins >= start || mins <= end;
}

function normalizeSchedule(input) {
  if (!input || typeof input !== "object") return null;
  return {
    useSchedule: !!input.useSchedule,
    start: typeof input.start === "string" ? input.start.trim() : "00:00",
    end: typeof input.end === "string" ? input.end.trim() : "23:59",
  };
}

export function normalizeServicePreferencesInput(input) {
  if (!input || typeof input !== "object") return null;
  const out = {};
  for (const key of SERVICE_TYPES) {
    if (input[key] && typeof input[key] === "object") {
      const entry = { enabled: input[key].enabled !== false };
      if (input[key].schedule) {
        entry.schedule = normalizeSchedule(input[key].schedule);
      }
      out[key] = entry;
    } else if (typeof input[key] === "boolean") {
      out[key] = { enabled: input[key] };
    }
  }
  return Object.keys(out).length ? out : null;
}

export function applyPresetToPreferences(presetId, existing = {}) {
  const preset = SERVICE_PRESETS[presetId];
  if (!preset) return null;
  const out = {};
  for (const key of SERVICE_TYPES) {
    const prev = existing[key] || {};
    out[key] = {
      enabled: !!preset[key],
      ...(prev.schedule ? { schedule: prev.schedule } : {}),
    };
  }
  return out;
}

export function detectPresetFromPreferences(prefs = {}) {
  for (const id of PRESET_IDS) {
    const preset = SERVICE_PRESETS[id];
    const match = SERVICE_TYPES.every(
      (k) => (prefs[k]?.enabled !== false) === !!preset[k]
    );
    if (match) return id;
  }
  return "custom";
}

/** Manual toggles only (ignores schedule). */
export function getRiderManualServicePreferences(user) {
  const prefs = user?.driverDetails?.servicePreferences || {};
  return {
    RIDE: prefs.RIDE?.enabled !== false,
    DELIVERY: prefs.DELIVERY?.enabled !== false,
    FOOD: prefs.FOOD?.enabled !== false,
  };
}

/** Effective availability right now (toggles + schedule windows). */
export function getEffectiveServicePreferences(user, now = new Date()) {
  const prefs = user?.driverDetails?.servicePreferences || {};
  const out = {};
  for (const key of SERVICE_TYPES) {
    const entry = prefs[key] || {};
    const manual = entry.enabled !== false;
    out[key] = manual && isWithinSchedule(entry.schedule, now);
  }
  return out;
}

export function buildServicePreferencesPayload(
  user,
  { vehicleCategory, vehicleSupportedServices } = {}
) {
  const vehicle = vehicleCategory || "motorcycle";
  const supported = vehicleSupportedServices || SERVICE_TYPES;
  const prefs = user?.driverDetails?.servicePreferences || {};
  const manual = getRiderManualServicePreferences(user);
  const effective = getEffectiveServicePreferences(user);
  const preset =
    user?.driverDetails?.servicePreset ||
    detectPresetFromPreferences(prefs);

  return {
    servicePreset: PRESET_IDS.includes(preset) ? preset : detectPresetFromPreferences(prefs),
    servicePreferences: prefs,
    manualPreferences: manual,
    effectivePreferences: effective,
    vehicleCategory: vehicle,
    vehicleSupportedServices: supported,
    labels: {
      RIDE: "Rides",
      DELIVERY: "Parcels",
      FOOD: "Food",
    },
  };
}

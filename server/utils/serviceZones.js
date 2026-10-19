import { calculateDistance } from "./mapUtils.js";
import ServiceZone, { SERVICE_ZONE_TYPES } from "../models/ServiceZone.js";
import Settings from "../models/Settings.js";
import { BadRequestError } from "../errors/index.js";

/**
 * @param {number} lat
 * @param {number} lng
 * @param {{ center: { latitude: number, longitude: number }, radiusKm: number }} zone
 */
export function isPointInZone(lat, lng, zone) {
  const distanceKm = calculateDistance(
    lat,
    lng,
    zone.center.latitude,
    zone.center.longitude
  );
  return {
    inside: distanceKm <= Number(zone.radiusKm),
    distanceKm: Number(distanceKm.toFixed(3)),
  };
}

export function normalizeServiceTypes(types) {
  if (!Array.isArray(types) || types.length === 0) {
    return [...SERVICE_ZONE_TYPES];
  }
  const set = new Set(
    types
      .map((t) => String(t).toUpperCase())
      .filter((t) => SERVICE_ZONE_TYPES.includes(t))
  );
  return set.size ? [...set] : [...SERVICE_ZONE_TYPES];
}

/**
 * Resolve coverage for a lat/lng against all active zones.
 * No active zones → open mode (everywhere allowed, all services).
 */
export async function resolveServiceCoverage(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      inServiceArea: false,
      openMode: false,
      allowedServices: [],
      matchedZones: [],
      message: "Valid latitude and longitude are required",
    };
  }

  const zones = await ServiceZone.find({ isActive: true }).lean();
  if (!zones.length) {
    return {
      inServiceArea: true,
      openMode: true,
      allowedServices: [...SERVICE_ZONE_TYPES],
      matchedZones: [],
      message: null,
    };
  }

  const matched = [];
  const allowed = new Set();

  for (const zone of zones) {
    const { inside, distanceKm } = isPointInZone(lat, lng, zone);
    if (!inside) continue;
    const services = normalizeServiceTypes(zone.serviceTypes);
    services.forEach((s) => allowed.add(s));
    matched.push({
      _id: zone._id,
      name: zone.name,
      radiusKm: zone.radiusKm,
      distanceKm,
      serviceTypes: services,
    });
  }

  if (!matched.length) {
    return {
      inServiceArea: false,
      openMode: false,
      allowedServices: [],
      matchedZones: [],
      message: "Service not available in your area",
    };
  }

  return {
    inServiceArea: true,
    openMode: false,
    allowedServices: [...allowed],
    matchedZones: matched,
    message: null,
  };
}

/**
 * Throw if lat/lng is outside coverage or the service is not enabled there.
 * No-op (open) when no active zones exist.
 */
export async function assertServiceAvailableAt(latitude, longitude, serviceType) {
  const coverage = await resolveServiceCoverage(latitude, longitude);
  if (coverage.openMode) return coverage;
  if (!coverage.inServiceArea) {
    throw new BadRequestError(
      coverage.message || "Service not available in your area"
    );
  }
  const type = String(serviceType || "").toUpperCase();
  if (SERVICE_ZONE_TYPES.includes(type) && !coverage.allowedServices.includes(type)) {
    throw new BadRequestError(`${type} is not available in your area`);
  }
  return coverage;
}

export { SERVICE_ZONE_TYPES };

const GAS_ZONE_MIGRATION = "gas-service-zones";

/**
 * Gas joined the service-area options after some areas were saved with an explicit list.
 * Gas used to be allowed anywhere inside an area, so add it to those areas once; after
 * that, switching gas off for an area sticks.
 */
export async function ensureGasInExistingZones() {
  const settings = await Settings.findOne({ key: "global" }).select("appliedMigrations");
  if (!settings || settings.appliedMigrations?.includes(GAS_ZONE_MIGRATION)) return;
  const result = await ServiceZone.updateMany(
    { "serviceTypes.0": { $exists: true }, serviceTypes: { $ne: "GAS" } },
    { $addToSet: { serviceTypes: "GAS" } }
  );
  await Settings.updateOne({ key: "global" }, { $addToSet: { appliedMigrations: GAS_ZONE_MIGRATION } });
  console.log(`[service-zones] added gas to ${result.modifiedCount} existing area(s)`);
}

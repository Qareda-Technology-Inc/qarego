/** Service types used for rider eligibility (parcel courier = DELIVERY in API). */
export const SERVICE_TYPES = ["RIDE", "DELIVERY", "FOOD"];

const BASE_VEHICLE_SERVICES = {
  motorcycle: ["RIDE", "DELIVERY", "FOOD"],
  pragya: ["RIDE", "DELIVERY"],
  comfort: ["RIDE", "DELIVERY"],
};

export function normalizeVehicleCategory(category) {
  const c = String(category || "motorcycle").toLowerCase();
  if (["motorcycle", "pragya", "comfort"].includes(c)) return c;
  return "motorcycle";
}

/** Map ride document to eligibility service type. */
export function getRideEligibilityServiceType(ride) {
  const st = ride?.serviceType || "RIDE";
  if (st === "FOOD") return "FOOD";
  if (st === "DELIVERY") return "DELIVERY";
  return "RIDE";
}

export function getVehicleCapabilityPolicy(settings = {}) {
  const policy = settings.vehicleCapabilityPolicy || {};
  return {
    pragyaFoodEnabled: !!policy.pragyaFoodEnabled,
    comfortFoodEnabled: !!policy.comfortFoodEnabled,
  };
}

/** Services a vehicle category may perform given platform policy. */
export function getVehicleSupportedServices(vehicleCategory, settings = {}) {
  const vehicle = normalizeVehicleCategory(vehicleCategory);
  const base = BASE_VEHICLE_SERVICES[vehicle] || BASE_VEHICLE_SERVICES.motorcycle;
  const list = [...base];
  const policy = getVehicleCapabilityPolicy(settings);
  if (vehicle === "pragya" && policy.pragyaFoodEnabled && !list.includes("FOOD")) {
    list.push("FOOD");
  }
  if (vehicle === "comfort" && policy.comfortFoodEnabled && !list.includes("FOOD")) {
    list.push("FOOD");
  }
  return list;
}

import {
  getEffectiveServicePreferences,
  getRiderManualServicePreferences,
} from "./riderServicePreferences.js";
import {
  isRiderServicePaused,
  getReliabilityRejectReason,
} from "./riderReliability.js";

export function getRiderServicePreferences(user, now = new Date()) {
  return getEffectiveServicePreferences(user, now);
}

/** When true, service is in maintenance and no offers are sent. */
export function isServiceInMaintenance(settings, serviceType) {
  const maintenance = settings?.serviceMaintenance || {};
  return maintenance[serviceType] === true;
}

export function canRiderReceiveOffer(rider, ride, settings = {}) {
  if (!rider || rider.role !== "rider") return false;
  if (rider.driverDetails?.status !== "active") return false;

  const serviceType = getRideEligibilityServiceType(ride);
  if (isRiderServicePaused(rider, serviceType)) return false;
  if (isServiceInMaintenance(settings, serviceType)) return false;

  const prefs = getRiderServicePreferences(rider);
  if (!prefs[serviceType]) return false;

  const vehicle = rider.driverDetails?.vehicle?.category;
  const supported = getVehicleSupportedServices(vehicle, settings);
  return supported.includes(serviceType);
}

export function getEligibilityRejectReason(rider, ride, settings = {}) {
  if (!rider || rider.role !== "rider") return "Not a rider account";
  if (rider.driverDetails?.status !== "active") return "Driver account is not active";

  const reliabilityReason = getReliabilityRejectReason(rider, ride);
  if (reliabilityReason) return reliabilityReason;

  const serviceType = getRideEligibilityServiceType(ride);
  const label =
    serviceType === "FOOD"
      ? "food delivery"
      : serviceType === "DELIVERY"
        ? "parcel delivery"
        : "ride";

  if (isServiceInMaintenance(settings, serviceType)) {
    return `${label} service is temporarily unavailable`;
  }

  const prefs = getRiderServicePreferences(rider);
  const manual = getRiderManualServicePreferences(rider);
  if (!prefs[serviceType]) {
    if (manual[serviceType]) {
      return `${label} offers are outside your scheduled hours`;
    }
    return `You have ${label} offers turned off in your work mode settings`;
  }

  const vehicle = normalizeVehicleCategory(rider.driverDetails?.vehicle?.category);
  const supported = getVehicleSupportedServices(vehicle, settings);
  if (!supported.includes(serviceType)) {
    if (serviceType === "FOOD") {
      return `Your vehicle (${vehicle}) is not enabled for food delivery on this platform`;
    }
    return `Your vehicle (${vehicle}) cannot accept this ${label} offer`;
  }

  return null;
}

export { normalizeServicePreferencesInput } from "./riderServicePreferences.js";

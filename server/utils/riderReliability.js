import User from "../models/User.js";
import { getRideEligibilityServiceType } from "./riderServiceEligibility.js";

const SERVICE_TYPES = ["RIDE", "DELIVERY", "FOOD"];

const DEFAULT_POLICY = {
  strikesBeforePause: 5,
  pauseDurationHours: 24,
  strikeDecayOnCompletion: 1,
  riderCancelStrikeWeight: 2,
};

export function getReliabilityPolicy(settings = {}) {
  const p = settings.reliabilityPolicy;
  if (!p || typeof p !== "object") return { ...DEFAULT_POLICY };
  return { ...DEFAULT_POLICY, ...p };
}

function emptyServiceStats() {
  return {
    strikes: 0,
    offersDeclined: 0,
    offersAccepted: 0,
    completed: 0,
    pausedUntil: null,
    pausedReason: null,
    lastEventAt: null,
  };
}

export function getRiderReliabilityRecord(user) {
  const raw = user?.driverDetails?.reliability || {};
  const out = {};
  for (const key of SERVICE_TYPES) {
    const s = raw[key] || {};
    const pausedUntil = s.pausedUntil ? new Date(s.pausedUntil) : null;
    const expired =
      pausedUntil && pausedUntil.getTime() <= Date.now();
    out[key] = {
      strikes: Number(s.strikes) || 0,
      offersDeclined: Number(s.offersDeclined) || 0,
      offersAccepted: Number(s.offersAccepted) || 0,
      completed: Number(s.completed) || 0,
      pausedUntil: expired ? null : pausedUntil,
      pausedReason: expired ? null : s.pausedReason || null,
      isPaused: pausedUntil && !expired,
    };
  }
  return out;
}

export function isRiderServicePaused(user, serviceType, now = new Date()) {
  if (user?.driverDetails?.status !== "active") return true;
  const rec = getRiderReliabilityRecord(user)[serviceType];
  if (!rec?.isPaused) return false;
  if (!rec.pausedUntil) return false;
  return rec.pausedUntil.getTime() > now.getTime();
}

export function getServicePauseReason(user, serviceType) {
  const rec = getRiderReliabilityRecord(user)[serviceType];
  if (!rec?.isPaused) return null;
  return (
    rec.pausedReason ||
    `${serviceType} offers paused due to reliability policy. Contact support if you need help.`
  );
}

function ensureReliabilityOnUser(user) {
  if (!user.driverDetails) user.driverDetails = {};
  if (!user.driverDetails.reliability) {
    user.driverDetails.reliability = {};
  }
  for (const key of SERVICE_TYPES) {
    if (!user.driverDetails.reliability[key]) {
      user.driverDetails.reliability[key] = emptyServiceStats();
    }
  }
}

function applyPauseIfNeeded(user, serviceType, policy) {
  const svc = user.driverDetails.reliability[serviceType];
  const threshold = Number(policy.strikesBeforePause) || DEFAULT_POLICY.strikesBeforePause;
  if (svc.strikes < threshold) return false;
  const hours = Number(policy.pauseDurationHours) || DEFAULT_POLICY.pauseDurationHours;
  const until = new Date(Date.now() + hours * 60 * 60 * 1000);
  svc.pausedUntil = until;
  svc.pausedReason = `${threshold} reliability strikes — ${serviceType} offers paused for ${hours}h`;
  return true;
}

/**
 * Record reliability event and optionally auto-pause a service.
 * @returns {{ paused: boolean, strikes: number, serviceType: string }}
 */
export async function recordReliabilityEvent(
  riderId,
  serviceType,
  eventType,
  settings = {}
) {
  if (!SERVICE_TYPES.includes(serviceType)) return null;

  const user = await User.findById(riderId);
  if (!user || user.role !== "rider") return null;

  const policy = getReliabilityPolicy(settings);
  ensureReliabilityOnUser(user);
  const svc = user.driverDetails.reliability[serviceType];
  const now = new Date();

  switch (eventType) {
    case "OFFER_DECLINED":
      svc.offersDeclined += 1;
      svc.strikes += 1;
      break;
    case "TRIP_COMPLETED":
      svc.completed += 1;
      svc.strikes = Math.max(
        0,
        svc.strikes - (Number(policy.strikeDecayOnCompletion) || 1)
      );
      break;
    case "TRIP_ACCEPTED":
      svc.offersAccepted += 1;
      break;
    case "ADMIN_RESET":
      Object.assign(svc, emptyServiceStats());
      break;
    case "ADMIN_PAUSE": {
      const hours = Number(policy.pauseDurationHours) || 24;
      svc.pausedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
      svc.pausedReason = "Paused by admin";
      break;
    }
    default:
      break;
  }

  svc.lastEventAt = now;
  let paused = false;
  if (eventType === "OFFER_DECLINED") {
    paused = applyPauseIfNeeded(user, serviceType, policy);
  }

  user.markModified("driverDetails");
  await user.save();

  return {
    serviceType,
    strikes: svc.strikes,
    paused,
    pausedUntil: svc.pausedUntil,
    pausedReason: svc.pausedReason,
  };
}

export function buildRiderReliabilityPayload(user, settings = {}) {
  const policy = getReliabilityPolicy(settings);
  const byService = getRiderReliabilityRecord(user);
  const labels = { RIDE: "Rides", DELIVERY: "Parcels", FOOD: "Food" };

  return {
    policy: {
      strikesBeforePause: policy.strikesBeforePause,
      pauseDurationHours: policy.pauseDurationHours,
    },
    services: SERVICE_TYPES.map((key) => ({
      serviceType: key,
      label: labels[key],
      ...byService[key],
      strikesUntilPause: Math.max(
        0,
        policy.strikesBeforePause - (byService[key]?.strikes || 0)
      ),
    })),
    accountStatus: user?.driverDetails?.status || "pending",
  };
}

export async function clearExpiredPauses(riderId) {
  const user = await User.findById(riderId);
  if (!user?.driverDetails?.reliability) return;
  let changed = false;
  const now = Date.now();
  for (const key of SERVICE_TYPES) {
    const s = user.driverDetails.reliability[key];
    if (s?.pausedUntil && new Date(s.pausedUntil).getTime() <= now) {
      s.pausedUntil = null;
      s.pausedReason = null;
      changed = true;
    }
  }
  if (changed) {
    user.markModified("driverDetails");
    await user.save();
  }
}

export function getReliabilityRejectReason(user, ride) {
  const serviceType = getRideEligibilityServiceType(ride);
  if (isRiderServicePaused(user, serviceType)) {
    return getServicePauseReason(user, serviceType);
  }
  return null;
}

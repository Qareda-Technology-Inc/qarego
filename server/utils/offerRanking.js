import { calculateDistance } from "./mapUtils.js";
import { getCommissionRateForService } from "./tripSettlement.js";
import { getRideEligibilityServiceType } from "./riderServiceEligibility.js";

const DEFAULT_WEIGHTS = {
  fareWeight: 1,
  earningsPerKmWeight: 8,
  pickupPenaltyPerKm: 4,
  urgencyWeight: 10,
  foodReadyBoost: 12,
  maxPickupKm: 25,
};

export function getDispatchWeights(settings = {}) {
  const w = settings.dispatchRankingWeights;
  if (!w || typeof w !== "object") return { ...DEFAULT_WEIGHTS };
  return { ...DEFAULT_WEIGHTS, ...w };
}

export function computeNetEarning(fare, commissionRate) {
  const f = Number(fare) || 0;
  const rate = Number(commissionRate) || 0;
  return Math.round(f * (1 - rate) * 100) / 100;
}

/**
 * Score an offer for a specific rider (distance, net pay, urgency).
 * Higher score = better match for this rider.
 */
export function scoreOfferForRider(ride, rider, riderCoords, settings = {}) {
  const weights = getDispatchWeights(settings);
  const fare = Number(ride?.fare ?? 0);
  const tripKm = Math.max(Number(ride?.distance ?? 0), 0.5);
  const serviceType = getRideEligibilityServiceType(ride);
  const commissionRate = getCommissionRateForService(settings, serviceType);
  const netEarning = computeNetEarning(fare, commissionRate);
  const earningsPerKm = netEarning / Math.max(tripKm, 0.8);

  let pickupKm = null;
  if (
    riderCoords?.latitude != null &&
    riderCoords?.longitude != null &&
    ride?.pickup?.latitude != null &&
    ride?.pickup?.longitude != null
  ) {
    pickupKm = calculateDistance(
      ride.pickup.latitude,
      ride.pickup.longitude,
      riderCoords.latitude,
      riderCoords.longitude
    );
  }

  let score =
    fare * weights.fareWeight + earningsPerKm * weights.earningsPerKmWeight;

  if (pickupKm != null) {
    score -= pickupKm * weights.pickupPenaltyPerKm;
    if (pickupKm > weights.maxPickupKm) score -= 80;
  }

  const createdAt = ride?.createdAt ? new Date(ride.createdAt).getTime() : Date.now();
  const ageMin = (Date.now() - createdAt) / 60000;
  if (ageMin > 1.5) {
    score += weights.urgencyWeight * Math.min(ageMin / 4, 2.5);
  }

  if (serviceType === "FOOD") {
    score += weights.foodReadyBoost;
  }

  const reasons = [];
  if (pickupKm != null && pickupKm < 2.5) reasons.push("near pickup");
  if (earningsPerKm >= netEarning / tripKm * 0.85) reasons.push("strong pay/km");
  if (serviceType === "FOOD") reasons.push("food ready");
  if (ageMin > 3) reasons.push("waiting customer");

  const rankHint =
    reasons.length > 0 ? reasons.slice(0, 2).join(" · ") : "balanced offer";

  const commissionAmount = Math.round(fare * commissionRate * 100) / 100;

  return {
    score: Math.round(score * 100) / 100,
    netEarning,
    grossFare: fare,
    commissionRate,
    commissionAmount,
    commissionPercent: Math.round(commissionRate * 1000) / 10,
    earningsPerKm: Math.round(earningsPerKm * 100) / 100,
    pickupKm: pickupKm != null ? Math.round(pickupKm * 100) / 100 : null,
    tripKm: Math.round(tripKm * 100) / 100,
    serviceType,
    rankHint,
  };
}

export function attachDispatchMeta(ride, dispatchMeta) {
  const base = ride?.toObject ? ride.toObject() : { ...ride };
  return { ...base, dispatchMeta };
}

export function sortRidesByScoreForRider(rides, rider, riderCoords, settings) {
  if (!Array.isArray(rides) || !rides.length) return [];
  return rides
    .map((ride) => {
      const dispatchMeta = scoreOfferForRider(ride, rider, riderCoords, settings);
      return { ride: attachDispatchMeta(ride, dispatchMeta), score: dispatchMeta.score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.ride);
}

export function rankEligibleRidersForRide(ridersWithCoords, ride, settings) {
  const weights = getDispatchWeights(settings);
  return ridersWithCoords
    .map(({ rider, coords }) => {
      const dispatchMeta = scoreOfferForRider(ride, rider, coords, settings);
      return { rider, coords, dispatchMeta, score: dispatchMeta.score };
    })
    .filter(
      (row) =>
        row.dispatchMeta.pickupKm == null || row.dispatchMeta.pickupKm <= weights.maxPickupKm
    )
    .sort((a, b) => b.score - a.score);
}

/** How many riders receive the offer on wave N (1-based). */
export function getDispatchPoolSize(waveIndex, totalEligible) {
  const wave1 = 3;
  const wave2 = 5;
  if (waveIndex <= 1) return Math.min(wave1, totalEligible);
  if (waveIndex === 2) return Math.min(wave1 + wave2, totalEligible);
  return totalEligible;
}

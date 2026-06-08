import { getCommissionRateForService } from "./tripSettlement.js";
import { getRideEligibilityServiceType } from "./riderServiceEligibility.js";
import { computeNetEarning } from "./offerRanking.js";

/** Build transparent fare → commission → net breakdown for riders. */
export function buildEarningsBreakdown(fare, commissionRate, serviceType = "RIDE") {
  const grossFare = Math.round((Number(fare) || 0) * 100) / 100;
  const rate = Number(commissionRate) || 0;
  const commissionAmount = Math.round(grossFare * rate * 100) / 100;
  const netEarning = computeNetEarning(grossFare, rate);
  return {
    grossFare,
    commissionRate: rate,
    commissionPercent: Math.round(rate * 1000) / 10,
    commissionAmount,
    netEarning,
    serviceType,
  };
}

export function buildEarningsBreakdownForRide(ride, settings = {}) {
  const serviceType = getRideEligibilityServiceType(ride);
  const rate = getCommissionRateForService(settings, serviceType);
  return buildEarningsBreakdown(ride?.fare, rate, serviceType);
}

export function buildEarningsBreakdownFromCommissionTxn(tx) {
  const fare = Number(tx?.ride?.fare ?? 0);
  const commissionAmount = Math.abs(Number(tx?.amount ?? 0));
  const serviceType = tx?.ride?.serviceType || "RIDE";
  const commissionRate = fare > 0 ? commissionAmount / fare : 0;
  return {
    grossFare: fare,
    commissionRate,
    commissionPercent: Math.round(commissionRate * 1000) / 10,
    commissionAmount,
    netEarning: Math.round((fare - commissionAmount) * 100) / 100,
    serviceType,
  };
}

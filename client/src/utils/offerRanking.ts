import { breakdownFromDispatchMeta, type EarningsBreakdown } from "./earningsBreakdown";

export type DispatchMeta = {
  score?: number;
  netEarning?: number;
  grossFare?: number;
  commissionRate?: number;
  commissionAmount?: number;
  commissionPercent?: number;
  earningsPerKm?: number;
  pickupKm?: number | null;
  tripKm?: number;
  rankHint?: string;
  serviceType?: string;
};

export type RankedOffer = {
  _id?: string;
  fare?: number;
  dispatchMeta?: DispatchMeta;
  createdAt?: string;
};

export function getOfferScore(offer?: RankedOffer | null): number {
  const score = offer?.dispatchMeta?.score;
  if (typeof score === "number" && Number.isFinite(score)) return score;
  return Number(offer?.fare ?? 0);
}

export function sortOffersByScore<T extends RankedOffer>(offers: T[]): T[] {
  return [...offers].sort((a, b) => getOfferScore(b) - getOfferScore(a));
}

export function getBestOfferId(offers: RankedOffer[]): string | null {
  if (!offers.length) return null;
  const best = sortOffersByScore(offers)[0];
  return best?._id ?? null;
}

export function getNetEarningDisplay(offer?: RankedOffer | null): number | null {
  const net = offer?.dispatchMeta?.netEarning;
  if (typeof net === "number" && Number.isFinite(net)) return net;
  return null;
}

export function getOfferEarningsBreakdown(
  offer?: RankedOffer | null
): EarningsBreakdown | null {
  return breakdownFromDispatchMeta(offer?.dispatchMeta, offer?.fare);
}

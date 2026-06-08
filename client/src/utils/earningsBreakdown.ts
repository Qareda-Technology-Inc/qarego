import { DispatchMeta } from "./offerRanking";
import { formatCurrency } from "./Constants";

export type EarningsBreakdown = {
  grossFare: number;
  commissionRate: number;
  commissionPercent: number;
  commissionAmount: number;
  netEarning: number;
  serviceType?: string;
};

export function breakdownFromDispatchMeta(
  meta?: DispatchMeta | null,
  fallbackFare?: number
): EarningsBreakdown | null {
  if (!meta && fallbackFare == null) return null;
  const grossFare = Number(meta?.grossFare ?? fallbackFare ?? 0);
  if (!grossFare) return null;
  const commissionRate = Number(meta?.commissionRate ?? 0);
  const commissionAmount =
    meta?.commissionAmount != null
      ? Number(meta.commissionAmount)
      : Math.round(grossFare * commissionRate * 100) / 100;
  const netEarning =
    meta?.netEarning != null
      ? Number(meta.netEarning)
      : Math.round((grossFare - commissionAmount) * 100) / 100;
  return {
    grossFare,
    commissionRate,
    commissionPercent:
      meta?.commissionPercent != null
        ? Number(meta.commissionPercent)
        : Math.round(commissionRate * 1000) / 10,
    commissionAmount,
    netEarning,
    serviceType: meta?.serviceType,
  };
}

export function serviceCommissionLabel(serviceType?: string): string {
  if (serviceType === "FOOD") return "Food";
  if (serviceType === "DELIVERY") return "Parcel";
  return "Ride";
}

export function formatBreakdownLines(b: EarningsBreakdown) {
  return {
    gross: formatCurrency(b.grossFare),
    commission: formatCurrency(b.commissionAmount),
    net: formatCurrency(b.netEarning),
    percent: `${b.commissionPercent}%`,
  };
}

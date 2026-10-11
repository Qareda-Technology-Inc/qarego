/**
 * Food service fee: a percentage of the food subtotal, clamped between min and max,
 * rounded to the pesewa. Mirrors client/src/utils/feeUtils.ts (calculateServiceFee).
 */
export function computeFoodServiceFee(subtotal, settings) {
  const rate = Number(settings?.foodServiceFeeRate ?? 0.08);
  const min = Number(settings?.foodServiceFeeMin ?? 2);
  const max = Number(settings?.foodServiceFeeMax ?? 12);
  const normalizedMax = Math.max(min, max);
  const raw = Number(subtotal) * rate;
  return Math.round(Math.min(normalizedMax, Math.max(min, raw)) * 100) / 100;
}

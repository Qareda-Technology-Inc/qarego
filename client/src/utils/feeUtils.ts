export function calculateServiceFee(
  subtotal: number,
  rate: number,
  minFee: number,
  maxFee: number
): number {
  const normalizedMax = Math.max(minFee, maxFee);
  const raw = subtotal * rate;
  // Rounded to the pesewa, same as server/utils/foodServiceFee.js.
  return Math.round(Math.min(normalizedMax, Math.max(minFee, raw)) * 100) / 100;
}

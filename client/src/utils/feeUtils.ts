export function calculateServiceFee(
  subtotal: number,
  rate: number,
  minFee: number,
  maxFee: number
): number {
  const normalizedMax = Math.max(minFee, maxFee);
  const raw = subtotal * rate;
  return Math.min(normalizedMax, Math.max(minFee, raw));
}

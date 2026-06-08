/**
 * Currency shared with mobile client (QareGO).
 * Ghana Cedi - use for all fare/price/revenue display in admin and client.
 */
export const CURRENCY_SYMBOL = "GH₵";

/**
 * Format amount as currency (e.g. "GH₵12.50").
 */
export function formatCurrency(amount: number | undefined | null): string {
  if (amount == null || Number.isNaN(amount)) return `${CURRENCY_SYMBOL}0.00`;
  return `${CURRENCY_SYMBOL}${Number(amount).toFixed(2)}`;
}

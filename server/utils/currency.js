/**
 * Currency shared across admin, client, and API (QareGO).
 * Ghana Cedi - use for all fare/price/revenue display.
 */
const CURRENCY_SYMBOL = 'GH₵';

/**
 * Format amount as currency string (e.g. "GH₵12.50").
 */
function formatCurrency(amount) {
  if (amount == null || Number.isNaN(amount)) return `${CURRENCY_SYMBOL}0.00`;
  return `${CURRENCY_SYMBOL}${Number(amount).toFixed(2)}`;
}

export { CURRENCY_SYMBOL, formatCurrency };

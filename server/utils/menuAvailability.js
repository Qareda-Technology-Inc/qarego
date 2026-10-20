/** Menu items a customer can order right now: switched on and not sold out for today. */
export function availableNowFilter(now = new Date()) {
  return {
    isAvailable: true,
    $or: [{ soldOutUntil: null }, { soldOutUntil: { $lte: now } }],
  };
}

/** End of today. Ghana is on UTC, so the day ends at UTC midnight. */
export function endOfToday(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

// Laundry shop options: what each price-list item is (its service), how long a wash takes, and
// an optional faster "Express" turnaround the shop charges extra for. Customer and shop apps
// keep copies of LAUNDRY_SERVICES (client/src/utils/laundryOptions.ts, merchant/src/lib).

export const LAUNDRY_SERVICES = ["WASH_FOLD", "WASH_IRON", "DRY_CLEAN", "IRON_ONLY"];

export const DEFAULT_LAUNDRY_OPTIONS = Object.freeze({
  standardHours: 48,
  expressEnabled: false,
  expressFee: 0,
  expressHours: 24,
});

const MAX_HOURS = 24 * 14;
const MAX_EXPRESS_FEE = 500;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** A price-list item's service, or null (an older item: shown under every service). */
export function normalizeLaundryService(value) {
  const v = String(value ?? "").trim().toUpperCase();
  return LAUNDRY_SERVICES.includes(v) ? v : null;
}

/** The shop's options with defaults filled in. */
export function laundryOptionsFor(restaurant) {
  const o = restaurant?.laundryOptions || {};
  return {
    standardHours: Number(o.standardHours) > 0 ? Number(o.standardHours) : DEFAULT_LAUNDRY_OPTIONS.standardHours,
    expressEnabled: !!o.expressEnabled && Number(o.expressFee) >= 0,
    expressFee: round2(o.expressFee),
    expressHours: Number(o.expressHours) > 0 ? Number(o.expressHours) : DEFAULT_LAUNDRY_OPTIONS.expressHours,
  };
}

/** The shop's edit of its options. Throws with a message the shop can act on. */
export function readLaundryOptions(body, previous) {
  const prev = laundryOptionsFor({ laundryOptions: previous });
  const hours = (raw, fallback, label) => {
    if (raw === undefined) return fallback;
    const n = Math.round(Number(raw));
    if (!(n >= 1 && n <= MAX_HOURS)) throw new Error(`${label} must be between 1 hour and 14 days`);
    return n;
  };
  const next = {
    standardHours: hours(body?.standardHours, prev.standardHours, "Normal turnaround"),
    expressHours: hours(body?.expressHours, prev.expressHours, "Express turnaround"),
    expressEnabled: body?.expressEnabled === undefined ? prev.expressEnabled : !!body.expressEnabled,
    expressFee: body?.expressFee === undefined ? prev.expressFee : round2(body.expressFee),
  };
  if (next.expressFee < 0 || next.expressFee > MAX_EXPRESS_FEE) {
    throw new Error(`Express fee must be between GH₵0 and GH₵${MAX_EXPRESS_FEE}`);
  }
  if (next.expressEnabled && next.expressHours >= next.standardHours) {
    throw new Error("Express has to be faster than your normal turnaround");
  }
  return next;
}

/** When the clean laundry is promised back: from the pickup (or now) plus the turnaround. */
export function laundryReturnBy(start, hours) {
  const from = start ? new Date(start) : new Date();
  return new Date(from.getTime() + hours * 3_600_000);
}

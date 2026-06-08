/**
 * Store opening-hours helpers.
 *
 * openingHours is an array of exactly 7 entries indexed by JS getDay()
 * (0 = Sunday … 6 = Saturday). Each entry:
 *   { closed: boolean, open: "HH:MM", close: "HH:MM" }
 *
 * When a restaurant has no openingHours set (undefined/empty), it is treated
 * as always within hours — only the manual pause / platform-active flags gate it.
 */

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DEFAULT_HOURS = Array.from({ length: 7 }, () => ({
  closed: false,
  open: "08:00",
  close: "22:00",
}));

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

function toMinutes(t) {
  const [h, m] = String(t).split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

/** Normalise an "H:MM" or "HH:MM" string to "HH:MM"; falls back to a default. */
function normTime(t, fallback) {
  if (typeof t !== "string" || !TIME_RE.test(t.trim())) return fallback;
  const [h, m] = t.trim().split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

/** Validate/clean an incoming openingHours payload into a safe 7-entry array. */
export function sanitizeHours(input) {
  if (!Array.isArray(input) || input.length !== 7) return undefined;
  return input.map((d) => {
    const closed = !!(d && d.closed);
    const open = normTime(d?.open, "08:00");
    const close = normTime(d?.close, "22:00");
    return { closed, open, close };
  });
}

/** Is `now` within the given day's open window (handles overnight windows)? */
export function isWithinHours(hours, now = new Date()) {
  if (!Array.isArray(hours) || hours.length !== 7) return true;
  const entry = hours[now.getDay()];
  if (!entry || entry.closed) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const openM = toMinutes(entry.open);
  const closeM = toMinutes(entry.close);
  if (closeM <= openM) {
    // Overnight window, e.g. 18:00–02:00
    return cur >= openM || cur < closeM;
  }
  return cur >= openM && cur < closeM;
}

/** Today's human-readable hours, e.g. "08:00–22:00" or "Closed today". */
export function todayHoursLabel(hours, now = new Date()) {
  if (!Array.isArray(hours) || hours.length !== 7) return null;
  const entry = hours[now.getDay()];
  if (!entry || entry.closed) return "Closed today";
  return `${entry.open}–${entry.close}`;
}

/**
 * Resolve whether a restaurant is open for orders right now.
 * Returns { isOpen, status, label, todayHours }.
 *   status: "open" | "paused" | "closed" | "unavailable"
 */
export function computeOpenState(restaurant, now = new Date()) {
  if (restaurant?.isActive === false) {
    return { isOpen: false, status: "unavailable", label: "Unavailable", todayHours: null };
  }
  if (restaurant?.isAcceptingOrders === false) {
    return { isOpen: false, status: "paused", label: "Temporarily closed", todayHours: null };
  }
  const hours = restaurant?.openingHours;
  if (Array.isArray(hours) && hours.length === 7 && !isWithinHours(hours, now)) {
    return {
      isOpen: false,
      status: "closed",
      label: "Closed",
      todayHours: todayHoursLabel(hours, now),
    };
  }
  return {
    isOpen: true,
    status: "open",
    label: "Open",
    todayHours: todayHoursLabel(hours, now),
  };
}

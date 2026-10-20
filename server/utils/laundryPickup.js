// Laundry pickup times: the customer books a 2-hour collection window instead of a rider being
// sent the moment the shop accepts. Slots follow the shop's opening hours; the rider request
// goes out a little before the window opens (see foodCourierBroadcastScheduler.js).
import { computeOpenState } from "./storeHours.js";

export const PICKUP_WINDOW_MIN = 120;
/** Offer the collection to riders this long before the window starts. */
export const PICKUP_LEAD_MIN = 15;
/** Earliest bookable window starts at least this far ahead. */
export const PICKUP_MIN_NOTICE_MIN = 60;
/** Today plus the next few days. */
export const PICKUP_DAYS = 4;
/** Shops without opening hours set: offer daytime pickups only. */
const FALLBACK_DAY = { closed: false, open: "08:00", close: "20:00" };

const toMinutes = (t) => {
  const [h, m] = String(t).split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
};

function dayHours(restaurant, date) {
  const hours = restaurant?.openingHours;
  if (!Array.isArray(hours) || hours.length !== 7) return FALLBACK_DAY;
  return hours[date.getDay()] || FALLBACK_DAY;
}

/** Bookable windows [{ start, end }] from now through the next few days. */
export function laundryPickupSlots(restaurant, now = new Date()) {
  const earliest = now.getTime() + PICKUP_MIN_NOTICE_MIN * 60_000;
  const slots = [];
  for (let d = 0; d < PICKUP_DAYS; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const entry = dayHours(restaurant, day);
    if (entry.closed) continue;
    const openM = toMinutes(entry.open);
    let closeM = toMinutes(entry.close);
    // Overnight hours (e.g. 18:00–02:00): pickups stop at midnight.
    if (closeM <= openM) closeM = 24 * 60;
    // Windows start on the hour, from opening until there's room for a full window.
    let startM = Math.ceil(openM / 60) * 60;
    const lastStart = Math.max(startM, closeM - PICKUP_WINDOW_MIN);
    for (; startM <= lastStart; startM += PICKUP_WINDOW_MIN) {
      const start = new Date(day.getTime() + startM * 60_000);
      if (start.getTime() < earliest) continue;
      slots.push({ start, end: new Date(start.getTime() + PICKUP_WINDOW_MIN * 60_000) });
    }
  }
  return slots;
}

/** "As soon as possible" only makes sense while the shop is open to accept it. */
export const laundryAsapAvailable = (restaurant, now = new Date()) => computeOpenState(restaurant, now).isOpen;

/**
 * Check a requested window start against the current slots. Returns the Date, or null when the
 * customer asked for "as soon as possible". Throws a readable message when it isn't bookable.
 */
export function resolveLaundryPickupAt(restaurant, requested, now = new Date()) {
  if (requested == null || requested === "") return null;
  const at = new Date(requested);
  if (Number.isNaN(at.getTime())) throw new Error("Choose a pickup time");
  const match = laundryPickupSlots(restaurant, now).find((s) => Math.abs(s.start.getTime() - at.getTime()) < 60_000);
  if (!match) throw new Error("That pickup time isn't available any more. Please choose another.");
  return match.start;
}

/** When to offer the collection to riders for a booked window. */
export const laundryPickupDispatchAt = (pickupAt) => new Date(new Date(pickupAt).getTime() - PICKUP_LEAD_MIN * 60_000);

/** Laundry pickup windows are 2 hours (server: utils/laundryPickup.js). */
export const LAUNDRY_PICKUP_WINDOW_MIN = 120;

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "Today", "Tomorrow" or "Thu 23 Oct" for a date. */
export function pickupDayLabel(date: Date, now = new Date()): string {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((day - today) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** "10:00–12:00" */
export function pickupTimeRange(start: string | Date, minutes = LAUNDRY_PICKUP_WINDOW_MIN): string {
  const s = new Date(start);
  return `${hhmm(s)}–${hhmm(new Date(s.getTime() + minutes * 60_000))}`;
}

/** "Tomorrow, 10:00–12:00" */
export function formatPickupWindow(start: string | Date, minutes = LAUNDRY_PICKUP_WINDOW_MIN): string {
  return `${pickupDayLabel(new Date(start))}, ${pickupTimeRange(start, minutes)}`;
}

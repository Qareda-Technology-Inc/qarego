/** Same as client/src/utils/laundryPickup.ts: laundry pickups are booked 2-hour windows. */
export const LAUNDRY_PICKUP_WINDOW_MIN = 120;

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "Today, 10:00–12:00", "Tomorrow, …" or "Thu 23 Oct, …" */
export function formatPickupWindow(start: string | Date, now = new Date()): string {
  const s = new Date(start);
  const e = new Date(s.getTime() + LAUNDRY_PICKUP_WINDOW_MIN * 60_000);
  const day = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((day - today) / 86_400_000);
  const label =
    diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : s.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${label}, ${hhmm(s)}–${hhmm(e)}`;
}

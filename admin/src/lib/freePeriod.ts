// Commission-free period of a store (server: utils/commissionFree.js).

const DAY_MS = 86_400_000;

export function isCommissionFree(until?: string | null, now = Date.now()): boolean {
  return !!until && new Date(until).getTime() > now;
}

/** Days left to the nearest day; a period ending later today still counts as 1. */
export function freeDaysLeft(until?: string | null, now = Date.now()): number {
  if (!isCommissionFree(until, now)) return 0;
  return Math.max(1, Math.round((new Date(until as string).getTime() - now) / DAY_MS));
}

export function formatFreeUntil(until: string): string {
  return new Date(until).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

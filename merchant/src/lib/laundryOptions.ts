/** Same list as server/utils/laundryOptions.js (and client/src/utils/laundryOptions.ts). */
export const LAUNDRY_SERVICES = [
  { id: "WASH_FOLD", label: "Wash and fold" },
  { id: "WASH_IRON", label: "Wash and iron" },
  { id: "DRY_CLEAN", label: "Dry clean" },
  { id: "IRON_ONLY", label: "Iron only" },
] as const;

export type LaundryServiceId = (typeof LAUNDRY_SERVICES)[number]["id"];

export const laundryServiceLabel = (id?: string | null) =>
  LAUNDRY_SERVICES.find((s) => s.id === id)?.label ?? null;

export type LaundryOptions = {
  standardHours: number;
  expressEnabled: boolean;
  expressFee: number;
  expressHours: number;
};

export const DEFAULT_LAUNDRY_OPTIONS: LaundryOptions = {
  standardHours: 48,
  expressEnabled: false,
  expressFee: 0,
  expressHours: 24,
};

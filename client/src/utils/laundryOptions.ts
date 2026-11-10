// Same list as server/utils/laundryOptions.js (and merchant/src/lib/laundryOptions.ts).
import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

export type LaundryServiceId = "WASH_FOLD" | "WASH_IRON" | "DRY_CLEAN" | "IRON_ONLY";

export const LAUNDRY_SERVICES: {
  id: LaundryServiceId;
  label: string;
  hint: string;
  icon: ComponentProps<typeof Ionicons>["name"];
}[] = [
  { id: "WASH_FOLD", label: "Wash and fold", hint: "Everyday clothes", icon: "water-outline" },
  { id: "WASH_IRON", label: "Wash and iron", hint: "Shirts, uniforms", icon: "shirt-outline" },
  { id: "DRY_CLEAN", label: "Dry clean", hint: "Suits, kente, delicates", icon: "sparkles-outline" },
  { id: "IRON_ONLY", label: "Iron only", hint: "Already clean", icon: "flame-outline" },
];

export const laundryServiceLabel = (id?: string | null) => LAUNDRY_SERVICES.find((s) => s.id === id)?.label ?? null;

/** An item belongs to a service; an item with none (older price lists) shows under every service. */
export const itemInService = (item: { laundryService?: string | null }, service: LaundryServiceId) =>
  !item.laundryService || item.laundryService === service;

export type LaundryOptions = {
  standardHours: number;
  expressEnabled: boolean;
  expressFee: number;
  expressHours: number;
};

export function laundryOptionsFor(restaurant?: { laundryOptions?: Partial<LaundryOptions> | null } | null): LaundryOptions {
  const o = restaurant?.laundryOptions || {};
  return {
    standardHours: Number(o.standardHours) > 0 ? Number(o.standardHours) : 48,
    expressEnabled: !!o.expressEnabled,
    expressFee: Math.round((Number(o.expressFee) || 0) * 100) / 100,
    expressHours: Number(o.expressHours) > 0 ? Number(o.expressHours) : 24,
  };
}

/** "back in 2 days" / "back in 6 hours" */
export function turnaroundLabel(hours: number): string {
  if (hours % 24 === 0) {
    const d = hours / 24;
    return d === 1 ? "next day" : `back in ${d} days`;
  }
  return `back in ${hours} hours`;
}

/** "Thu 4:00 pm" (or "today 4:00 pm" / "tomorrow …"). */
export function returnByLabel(iso: string | Date, now = new Date()): string {
  const d = new Date(iso);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((day - today) / 86_400_000);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
  if (diff === 0) return `today ${time}`;
  if (diff === 1) return `tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

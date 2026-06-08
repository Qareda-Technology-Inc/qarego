import { Platform } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";

export const COMMERCE_TAB_ACTIVE = "#f97316";
export const COMMERCE_TAB_INACTIVE = "#94a3b8";

/** Screens where the commerce bottom tabs stay visible. */
const COMMERCE_TAB_ROOTS = new Set([
  "/customer/hub",
  "/customer/stores",
  "/customer/stores/index",
  "/customer/restaurants",
  "/customer/search",
  "/customer/orders",
  "/customer/account",
]);

/** Base tab bar chrome height (icons + labels, excluding home-indicator inset). */
export const COMMERCE_TAB_BAR_BASE = Platform.OS === "ios" ? 52 : 56;

export function commerceTabBarHeight(insets: EdgeInsets): number {
  return COMMERCE_TAB_BAR_BASE + Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0);
}

export function commerceTabBarStyle(insets: EdgeInsets, hidden = false) {
  if (hidden) {
    return { display: "none" as const };
  }
  const bottomPad = Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0);
  return {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e8ebeb",
    height: COMMERCE_TAB_BAR_BASE + bottomPad,
    paddingTop: 6,
    paddingBottom: bottomPad,
    elevation: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  };
}

function normalizePath(pathname: string): string {
  return pathname.split("?")[0].replace(/\/$/, "") || "/";
}

/**
 * Hide tabs only on nested store screens (menu, cart, checkout, order).
 * Tab roots always keep the bar visible.
 */
export function shouldHideCommerceTabBar(pathname: string): boolean {
  const path = normalizePath(pathname);
  if (COMMERCE_TAB_ROOTS.has(path)) return false;
  if (path.startsWith("/customer/stores/")) return true;
  if (path.startsWith("/customer/restaurants/")) return true;
  return false;
}

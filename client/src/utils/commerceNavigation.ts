import { router } from "expo-router";
import type { StoreVertical } from "@/utils/storeVertical";

/**
 * Enter the commerce tab shell (required for bottom nav) on top of the services screen, so Back
 * (button, swipe or Android back) returns to it. Food lands on Home; Groceries, Pharmacy and
 * Laundry open their own list straight away. They used to replace the services screen and go
 * through Home first, which left the restaurants page as the only thing to go back to.
 */
export function openCommerceModule(vertical: StoreVertical) {
  if (vertical === "FOOD") {
    router.navigate("/customer/hub");
    return;
  }
  router.navigate({
    pathname: "/customer/stores",
    params: { type: vertical },
  });
}

/** Leave the commerce modules for the services screen (pops back to it; never stacks a copy). */
export function leaveCommerce() {
  router.dismissTo("/customer");
}

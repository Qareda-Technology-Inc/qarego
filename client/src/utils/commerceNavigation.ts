import { router } from "expo-router";
import type { StoreVertical } from "@/utils/storeVertical";

/** Enter the commerce tab shell (required for bottom nav). Food lands on Home. */
export function openCommerceModule(vertical: StoreVertical) {
  if (vertical === "FOOD") {
    router.replace("/customer/hub");
    return;
  }
  router.replace({
    pathname: "/customer/hub",
    params: { storeType: vertical },
  });
}

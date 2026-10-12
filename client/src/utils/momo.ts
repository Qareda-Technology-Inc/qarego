import { router } from "expo-router";

/**
 * Mobile money is paused while QareGO moves to a new MoMo provider. Every MoMo entry point
 * (checkout choice, rider debt top-up, rider cash out) opens the "coming soon" page instead.
 * Flip to true once the new provider is wired up.
 */
export const MOMO_AVAILABLE = false;

export type MomoFeature = "pay" | "topup" | "cashout";

export function openMomoComingSoon(feature: MomoFeature = "pay") {
  router.push({ pathname: "/momo-coming-soon", params: { feature } } as never);
}

import { router } from "expo-router";
import { useEffect, useState } from "react";
import { appAxios } from "@/service/apiInterceptors";

/**
 * Mobile money availability follows the server's switch (GET /features → momoEnabled), so
 * customer payments, rider debt top-up and cash out turn on or off without a new app build.
 */

export type MomoFeature = "pay" | "topup" | "cashout";

export function openMomoComingSoon(feature: MomoFeature = "pay") {
  router.push({ pathname: "/momo-coming-soon", params: { feature } } as never);
}

let payEnabled: boolean | null = null;
let pending: Promise<boolean> | null = null;
const listeners = new Set<(on: boolean) => void>();

/** Ask the server once per app session (again after a failure). */
function loadPayEnabled(): Promise<boolean> {
  if (payEnabled !== null) return Promise.resolve(payEnabled);
  if (!pending) {
    pending = appAxios
      .get("/features", { timeout: 10_000 })
      .then((res) => {
        payEnabled = !!res.data?.momoEnabled;
        listeners.forEach((fn) => fn(payEnabled!));
        return payEnabled;
      })
      .catch(() => false)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/** True when customers can pay with mobile money (server switch). */
export function useMomoPayAvailable(): boolean {
  const [on, setOn] = useState(payEnabled ?? false);
  useEffect(() => {
    listeners.add(setOn);
    loadPayEnabled().then(setOn);
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return on;
}

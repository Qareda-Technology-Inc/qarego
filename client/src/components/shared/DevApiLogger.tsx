import { useEffect } from "react";
import Constants from "expo-constants";
import {
  ensureApiBaseUrl,
  getApiBaseUrl,
  getAppEnvironment,
  isProductionApi,
  usesLoopbackApi,
} from "@/service/config";
import {
  getMetroHostFromScriptUrl,
  isPhysicalDevice,
} from "@/utils/deviceInfo";

/** Logs resolved API URL once in dev (physical device debugging). */
export function DevApiLogger() {
  useEffect(() => {
    if (!__DEV__) return;

    let cancelled = false;

    (async () => {
      const hostUri = Constants.expoConfig?.hostUri ?? "(none)";
      const scriptHost = getMetroHostFromScriptUrl() ?? "(none)";
      const physical = isPhysicalDevice();

      const api = await ensureApiBaseUrl();
      if (cancelled) return;

      console.log(
        "[QareGO] API:",
        api,
        "| env:",
        getAppEnvironment(),
        "| hostUri:",
        hostUri,
        "| scriptHost:",
        scriptHost,
        "| physicalDevice:",
        physical
      );

      const reachable = await fetch(`${api.replace(/\/$/, "")}/health`)
        .then((r) => r.ok)
        .catch(() => false);
      if (cancelled) return;

      if (reachable) {
        console.log("[QareGO] API reachable at", api);
        return;
      }

      if (isProductionApi()) {
        console.warn(
          "[QareGO] Cannot reach production API at",
          api,
          "— check EXPO_PUBLIC_PRODUCTION_API_URL and server status"
        );
      } else if (physical && usesLoopbackApi()) {
        console.warn(
          "[QareGO] Cannot reach API at",
          api,
          "— USB: npm start (usb:reverse), or Wi‑Fi: npm run dev:api → EXPO_PUBLIC_API_URL in client/.env"
        );
      } else if (physical) {
        console.warn(
          "[QareGO] Cannot reach API at",
          api,
          "— check server (cd server && npm start) and same Wi‑Fi / VPN off"
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

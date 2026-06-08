import { Platform } from "react-native";
import Constants from "expo-constants";
import {
  getAppEnvironment,
  isProductionApi,
  requireProductionApiUrl,
} from "@/service/appEnvironment";
import {
  getMetroHostFromScriptUrl,
  isAndroidEmulator,
  isIosSimulator,
  isPhysicalDevice,
} from "@/utils/deviceInfo";

/** Must match server PORT */
export const API_PORT = 2026;

/** Dev-only full URL override — optional; app auto-discovers if unset or unreachable */
const ENV_DEV_API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

/** Optional: only the Mac IP (e.g. 192.168.1.5) */
const ENV_LAN_HOST = process.env.EXPO_PUBLIC_DEV_LAN_HOST?.trim();

let resolvedApiBaseUrl: string | null = null;
let discoveryPromise: Promise<string> | null = null;

function hostFromRaw(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw);
  const hostPart = s.includes("://") ? s.split("://")[1] : s;
  const host = hostPart?.split(":")[0]?.split("/")[0]?.trim();
  if (!host) return null;
  return host;
}

function isLanIpv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/** All hosts Metro / Expo report (including 127.0.0.1 for USB adb reverse). */
function getAllMetroHosts(): string[] {
  const manifest2 = (Constants as { manifest2?: Record<string, unknown> }).manifest2;
  const extra = manifest2?.extra as Record<string, unknown> | undefined;
  const expoClient = extra?.expoClient as { hostUri?: string } | undefined;
  const devLauncher = (Constants as { expoConfig?: { hostUri?: string } }).expoConfig;

  const sources: unknown[] = [
    getMetroHostFromScriptUrl(),
    Constants.expoConfig?.hostUri,
    expoClient?.hostUri,
    devLauncher?.hostUri,
    (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost,
    (Constants as { linkingUri?: string }).linkingUri,
  ];

  const hosts = new Set<string>();
  for (const raw of sources) {
    const host = hostFromRaw(raw);
    if (host) hosts.add(host);
  }
  return [...hosts];
}

/** Mac LAN IP only (excludes loopback) */
function getDevServerLanHost(): string | null {
  for (const host of getAllMetroHosts()) {
    if (host !== "localhost" && host !== "127.0.0.1" && isLanIpv4(host)) {
      return host;
    }
  }
  return null;
}

function getLocalSyncApiBaseUrl(): string {
  if (Platform.OS === "web" || isIosSimulator()) {
    return `http://127.0.0.1:${API_PORT}`;
  }

  if (isAndroidEmulator()) {
    return `http://10.0.2.2:${API_PORT}`;
  }

  if (isPhysicalDevice()) {
    const metroHosts = getAllMetroHosts();
    if (metroHosts.includes("127.0.0.1")) {
      return `http://127.0.0.1:${API_PORT}`;
    }
    const lan = getDevServerLanHost();
    if (lan) return `http://${lan}:${API_PORT}`;
    if (ENV_DEV_API_URL) return ENV_DEV_API_URL;
    if (ENV_LAN_HOST && isLanIpv4(ENV_LAN_HOST)) {
      return `http://${ENV_LAN_HOST}:${API_PORT}`;
    }
    return `http://127.0.0.1:${API_PORT}`;
  }

  const lan = getDevServerLanHost();
  if (lan) return `http://${lan}:${API_PORT}`;
  if (ENV_DEV_API_URL) return ENV_DEV_API_URL;
  return `http://127.0.0.1:${API_PORT}`;
}

/** Best guess before async discovery finishes */
export function getSyncApiBaseUrl(): string {
  if (isProductionApi()) {
    const cloud = requireProductionApiUrl();
    if (cloud) return cloud;
    if (__DEV__) {
      console.warn(
        "[QareGO] EXPO_PUBLIC_PRODUCTION_API_URL not set — falling back to local dev server"
      );
      return getLocalSyncApiBaseUrl();
    }
    return "";
  }
  return getLocalSyncApiBaseUrl();
}

/** Ordered candidates for physical device — USB tunnel tried before stale .env LAN IP */
function buildApiCandidates(): string[] {
  const candidates: string[] = [];
  const metroHosts = getAllMetroHosts();
  const usesUsbMetro =
    metroHosts.includes("127.0.0.1") || metroHosts.includes("localhost");

  if (usesUsbMetro) {
    candidates.push(`http://127.0.0.1:${API_PORT}`);
  }

  for (const host of metroHosts) {
    if (isLanIpv4(host)) {
      candidates.push(`http://${host}:${API_PORT}`);
    }
  }

  if (ENV_DEV_API_URL) candidates.push(ENV_DEV_API_URL);

  if (ENV_LAN_HOST && isLanIpv4(ENV_LAN_HOST)) {
    candidates.push(`http://${ENV_LAN_HOST}:${API_PORT}`);
  }

  if (!usesUsbMetro) {
    candidates.push(`http://127.0.0.1:${API_PORT}`);
  }

  return [...new Set(candidates)];
}

async function pingApiAt(base: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const url = `${base.replace(/\/$/, "")}/health`;
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolves API base URL. Production uses cloud URL; development probes USB/Wi‑Fi on device.
 */
export async function ensureApiBaseUrl(): Promise<string> {
  if (resolvedApiBaseUrl) return resolvedApiBaseUrl;
  if (discoveryPromise) return discoveryPromise;

  discoveryPromise = (async () => {
    if (isProductionApi()) {
      const cloud = requireProductionApiUrl();
      if (cloud) {
        resolvedApiBaseUrl = cloud;
        if (__DEV__) {
          console.log(
            "[QareGO] Production API:",
            resolvedApiBaseUrl,
            `(env: ${getAppEnvironment()})`
          );
        }
        return resolvedApiBaseUrl;
      }
      if (__DEV__) {
        console.warn(
          "[QareGO] EXPO_PUBLIC_PRODUCTION_API_URL not set — using local dev server"
        );
      } else {
        console.error(
          "[QareGO] EXPO_PUBLIC_PRODUCTION_API_URL is required for production builds"
        );
        resolvedApiBaseUrl = "";
        return resolvedApiBaseUrl;
      }
    }

    if (!__DEV__ || !isPhysicalDevice()) {
      resolvedApiBaseUrl = getLocalSyncApiBaseUrl();
      return resolvedApiBaseUrl;
    }

    const candidates = buildApiCandidates();
    const tried: string[] = [];

    for (const url of candidates) {
      tried.push(url);
      if (await pingApiAt(url)) {
        resolvedApiBaseUrl = url.replace(/\/$/, "");
        if (__DEV__) {
          console.log("[QareGO] Dev API connected at", resolvedApiBaseUrl);
        }
        return resolvedApiBaseUrl;
      }
    }

    resolvedApiBaseUrl = candidates[0] ?? getLocalSyncApiBaseUrl();
    if (__DEV__) {
      console.warn(
        "[QareGO] API not reachable. Tried:",
        tried.join(", "),
        "— using",
        resolvedApiBaseUrl
      );
    }
    return resolvedApiBaseUrl;
  })();

  return discoveryPromise;
}

/** Use after ensureApiBaseUrl() in dev on physical devices; sync guess otherwise */
export function getApiBaseUrl(): string {
  return resolvedApiBaseUrl ?? getSyncApiBaseUrl();
}

export function resetApiBaseUrlDiscovery(): void {
  resolvedApiBaseUrl = null;
  discoveryPromise = null;
}

export function getSocketUrl(): string {
  const base = getApiBaseUrl();
  if (base.startsWith("https://")) {
    return base.replace(/^https:\/\//, "wss://");
  }
  return base.replace(/^http:\/\//, "ws://");
}

export async function pingApiHealth(): Promise<boolean> {
  return pingApiAt(await ensureApiBaseUrl());
}

export function usesLoopbackApi(): boolean {
  const api = getApiBaseUrl();
  return api.includes("127.0.0.1") || api.includes("localhost");
}

export function getLastApiDiscoveryTried(): string[] {
  if (isProductionApi()) {
    const url = getSyncApiBaseUrl();
    return url ? [url] : [];
  }
  return buildApiCandidates();
}

/** Shown when login/API fails with Network Error on a real device */
export function getPhysicalDeviceNetworkHelp(): string {
  const api = getApiBaseUrl();

  if (isProductionApi()) {
    return (
      `Cannot reach the server at ${api}\n\n` +
      "Check your internet connection and try again. " +
      "If this persists, the production API may be down or EXPO_PUBLIC_PRODUCTION_API_URL may be wrong."
    );
  }

  const tried = getLastApiDiscoveryTried();
  const usingLoopback = usesLoopbackApi();

  if (!__DEV__ || !isPhysicalDevice()) {
    return "Check your internet connection and try again.";
  }

  const triedLine =
    tried.length > 1 ? `\nTried: ${tried.join(" → ")}\n` : "";

  if (usingLoopback) {
    return (
      `Cannot reach the API at ${api}\n${triedLine}\n` +
      "USB dev (most reliable):\n" +
      "  1) Plug in Android, USB debugging on\n" +
      "  2) cd client && npm start  (forwards ports 2026 + 8081)\n" +
      "  3) Reload the app\n\n" +
      "Wi‑Fi instead:\n" +
      "  • Comment out EXPO_PUBLIC_API_URL in client/.env\n" +
      "  • npm run dev:api → set URL if needed → npx expo start -c\n" +
      "  • Phone browser: http://YOUR_MAC_IP:2026/health must show ok\n" +
      "  • Mac firewall must allow Node on port 2026"
    );
  }

  return (
    `Cannot reach the API at ${api}\n${triedLine}\n` +
    "1) Phone browser: open " +
    api.replace(/\/$/, "") +
    '/health — need {"ok":true}\n\n' +
    "2) Same Wi‑Fi as Mac, VPN off, not guest Wi‑Fi\n\n" +
    "3) Mac firewall: allow Node.js (ports 8081 + 2026)\n\n" +
    "4) Or USB: comment EXPO_PUBLIC_API_URL in client/.env → npm start → reload"
  );
}

export { getAppEnvironment, isProductionApi } from "@/service/appEnvironment";

import { NativeModules, Platform } from "react-native";
import * as Device from "expo-device";

/** Expo SDK 52+ removed Constants.isDevice — use expo-device instead. */
export function isPhysicalDevice(): boolean {
  return Device.isDevice === true;
}

export function isAndroidEmulator(): boolean {
  return Platform.OS === "android" && Device.isDevice === false;
}

export function isIosSimulator(): boolean {
  return Platform.OS === "ios" && Device.isDevice === false;
}

function hostFromRaw(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw);
  const hostPart = s.includes("://") ? s.split("://")[1] : s;
  const host = hostPart?.split(":")[0]?.split("/")[0]?.trim();
  if (!host) return null;
  return host;
}

/** Metro bundler IP from the JS bundle URL (works when expo hostUri is missing). */
export function getMetroHostFromScriptUrl(): string | null {
  try {
    const source = NativeModules.SourceCode as
      | { scriptURL?: string; getConstants?: () => { scriptURL?: string } }
      | undefined;
    const scriptURL =
      source?.getConstants?.()?.scriptURL ?? source?.scriptURL;
    if (!scriptURL) return null;
    const host = hostFromRaw(scriptURL);
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return host;
    }
  } catch {
    /* ignore */
  }
  return null;
}

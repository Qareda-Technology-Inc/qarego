/** Store links — replace when live on App Store / Play Store */
export const STORE_LINKS = {
  appStore:
    import.meta.env.VITE_APP_STORE_URL?.trim() ||
    "https://apps.apple.com/app/qarego",
  playStore:
    import.meta.env.VITE_PLAY_STORE_URL?.trim() ||
    "https://play.google.com/store/apps/details?id=com.qarego.client",
} as const;

/** Set to true once both listings are public */
export const STORES_LIVE =
  String(import.meta.env.VITE_STORES_LIVE || "").toLowerCase() === "true";

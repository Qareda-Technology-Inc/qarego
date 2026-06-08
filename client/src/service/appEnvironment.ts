export type AppEnvironment = "development" | "production";

const ENV_APP = process.env.EXPO_PUBLIC_APP_ENV?.trim().toLowerCase();
const PRODUCTION_API_URL = process.env.EXPO_PUBLIC_PRODUCTION_API_URL?.replace(
  /\/$/,
  ""
);

/** Active API target: local dev server vs deployed cloud API. */
export function getAppEnvironment(): AppEnvironment {
  if (ENV_APP === "production") return "production";
  if (ENV_APP === "development") return "development";
  // Release builds (TestFlight, App Store) always use cloud unless overridden.
  return __DEV__ ? "development" : "production";
}

export function isProductionApi(): boolean {
  return getAppEnvironment() === "production";
}

export function getProductionApiUrl(): string | null {
  return PRODUCTION_API_URL || null;
}

/** Returns cloud API URL, or empty string if unset (caller decides fallback). */
export function requireProductionApiUrl(): string {
  return getProductionApiUrl() ?? "";
}

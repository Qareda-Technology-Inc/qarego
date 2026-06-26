export type AppEnvironment = "development" | "production";

export const LOCAL_API_URL = "http://127.0.0.1:2026";

/** Local Mac server vs cloud API (Render). */
export function getAppEnvironment(): AppEnvironment {
  const explicit = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase();
  if (explicit === "production") return "production";
  if (explicit === "development") return "development";
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function isProductionApi(): boolean {
  return getAppEnvironment() === "production";
}

export function getProductionApiUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_PRODUCTION_API_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

/** Backend origin for /api proxy and direct uploads. */
export function resolveApiOrigin(): string {
  if (isProductionApi()) {
    const cloud = getProductionApiUrl();
    if (cloud) return cloud;
  }

  const override =
    process.env.API_PROXY_TARGET?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (override) return override.replace(/\/$/, "");
  return LOCAL_API_URL;
}

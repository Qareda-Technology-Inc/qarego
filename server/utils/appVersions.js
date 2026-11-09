// App update prompts: per platform, the newest store build and the oldest build still allowed.
// Build numbers are the store's (Android versionCode, iOS build number), so two builds that both
// say "1.0.5" still compare correctly. 0 means "not set": no prompt.

const STORE_URLS = {
  android: "https://play.google.com/store/apps/details?id=com.qarego.client",
  ios: "https://apps.apple.com/app/id6777809976",
};

export const APP_PLATFORMS = ["android", "ios"];

const toBuild = (v) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function readPlatform(raw, platform) {
  const p = raw && typeof raw === "object" ? raw : {};
  const latestBuild = toBuild(p.latestBuild);
  return {
    latestBuild,
    // Never above the latest: you can't require a build that isn't out.
    minBuild: Math.min(toBuild(p.minBuild), latestBuild || Infinity) || 0,
    storeUrl: /^https:\/\//.test(String(p.storeUrl || "")) ? String(p.storeUrl) : STORE_URLS[platform],
  };
}

/** Normalised app version settings, with defaults. */
export function getAppVersionConfig(settings) {
  const raw = settings?.appVersions && typeof settings.appVersions === "object" ? settings.appVersions : {};
  return {
    android: readPlatform(raw.android, "android"),
    ios: readPlatform(raw.ios, "ios"),
    message: String(raw.message || "").trim().slice(0, 200),
  };
}

/** Validates an admin PATCH; returns the value to store or throws. */
export function normalizeAppVersionsInput(input) {
  if (!input || typeof input !== "object") throw new Error("appVersions must be an object");
  for (const platform of APP_PLATFORMS) {
    const p = input[platform] || {};
    for (const k of ["latestBuild", "minBuild"]) {
      if (p[k] != null && p[k] !== "" && !(Number(p[k]) >= 0)) throw new Error("Build numbers must be 0 or more");
    }
    if (toBuild(p.minBuild) > toBuild(p.latestBuild)) {
      throw new Error(`${platform === "ios" ? "iOS" : "Android"}: the oldest allowed build can't be newer than the latest`);
    }
    if (p.storeUrl && !/^https:\/\//.test(String(p.storeUrl))) throw new Error("Store links must start with https://");
  }
  return getAppVersionConfig({ appVersions: input });
}

/**
 * What a phone on `build` should do: "required" (can't continue), "available" (a newer one is
 * out) or "none".
 */
export function updateStatus(platformConfig, build) {
  const b = toBuild(build);
  if (!b || !platformConfig) return "none";
  if (platformConfig.minBuild && b < platformConfig.minBuild) return "required";
  if (platformConfig.latestBuild && b < platformConfig.latestBuild) return "available";
  return "none";
}

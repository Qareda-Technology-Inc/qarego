/** Dynamic Expo config — injects .env into native Google Maps keys + dev-client plugin. */
const appJson = require("./app.base.json");
const fs = require("fs");
const path = require("path");

const googleMapsKey =
  process.env.GOOGLE_API_KEY || process.env.EXPO_PUBLIC_MAP_API_KEY || "";

function resolveFirebaseFile(...candidates) {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const resolved = path.isAbsolute(trimmed)
      ? trimmed
      : path.resolve(__dirname, trimmed);
    if (fs.existsSync(resolved)) return resolved;
  }
  return undefined;
}

const iosGoogleServiceFile = resolveFirebaseFile(
  process.env.GOOGLE_SERVICE_INFO_PLIST,
  process.env.IOS_GOOGLE_SERVICE_INFO_PLIST,
  "./GoogleService-Info.plist"
);

const androidGoogleServicesFile = resolveFirebaseFile(
  process.env.GOOGLE_SERVICES_JSON,
  process.env.ANDROID_GOOGLE_SERVICES_JSON,
  "./google-services.json"
);

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  ...appJson.expo,
  plugins: ["expo-dev-client", ...(appJson.expo.plugins || [])],
  ios: {
    ...appJson.expo.ios,
    ...(iosGoogleServiceFile ? { googleServicesFile: iosGoogleServiceFile } : {}),
    config: {
      ...appJson.expo.ios?.config,
      googleMapsApiKey: googleMapsKey,
    },
    infoPlist: {
      ...appJson.expo.ios?.infoPlist,
      ITSAppUsesNonExemptEncryption: false,
      NSBonjourServices: ["_expo._tcp"],
    },
  },
  android: {
    ...appJson.expo.android,
    ...(androidGoogleServicesFile ? { googleServicesFile: androidGoogleServicesFile } : {}),
    config: {
      ...appJson.expo.android?.config,
      googleMaps: {
        ...appJson.expo.android?.config?.googleMaps,
        apiKey: googleMapsKey,
      },
    },
  },
};

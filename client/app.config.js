/** Dynamic Expo config — injects .env into native Google Maps keys + dev-client plugin. */
const appJson = require("./app.base.json");
const fs = require("fs");
const path = require("path");

// Ensure native prebuild / run:* see client/.env (Expo does not always load it for app.config).
try {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch {
  /* dotenv optional at config time */
}

const googleMapsKey = (
  process.env.GOOGLE_API_KEY ||
  process.env.EXPO_PUBLIC_MAP_API_KEY ||
  ""
).trim();

if (!googleMapsKey) {
  // Without the key, Android crashes on every map screen, so never ship it.
  // .env is git-ignored: on EAS, set EXPO_PUBLIC_MAP_API_KEY as an EAS env var.
  if (process.env.EAS_BUILD) {
    throw new Error(
      "[app.config] EXPO_PUBLIC_MAP_API_KEY is not set for this EAS build. Add it with `eas env:create`."
    );
  }
  console.warn(
    "[app.config] Missing GOOGLE_API_KEY / EXPO_PUBLIC_MAP_API_KEY — Android/iOS maps will be blank."
  );
}

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
  plugins: [
    "expo-dev-client",
    ...(appJson.expo.plugins || []),
    "./plugins/withStripPhotoPermissions",
    "./plugins/withFmtCxx17",
    "./plugins/withPodsMinDeploymentTarget",
    // react-native-maps >= 1.21 adds Google Maps on iOS itself (pod subspec + AppDelegate init).
    // Expo's built-in ios.config.googleMapsApiKey would add the old 'react-native-google-maps'
    // pod, which no longer exists, so the iOS key is passed here instead.
    // The Android key must be passed too: without it this plugin deletes
    // com.google.android.geo.API_KEY from the manifest and map screens crash.
    [
      "react-native-maps",
      { iosGoogleMapsApiKey: googleMapsKey, androidGoogleMapsApiKey: googleMapsKey },
    ],
  ],
  ios: {
    ...appJson.expo.ios,
    ...(iosGoogleServiceFile ? { googleServicesFile: iosGoogleServiceFile } : {}),
    config: {
      ...appJson.expo.ios?.config,
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

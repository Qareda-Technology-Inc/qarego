/** @type {import('expo/config').ExpoConfig} */
const fs = require("fs");
const path = require("path");

const appJson = require("./app.json");

const ROOT = __dirname;

/**
 * Resolve Firebase config for local dev vs EAS Build.
 * EAS file env vars (set once via `npm run eas:firebase-env`) point at injected copies on the builder.
 */
function resolveFirebaseConfigFile(envVar, relativePath, label) {
  const envPath = process.env[envVar];
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const localPath = path.join(ROOT, relativePath);
  if (fs.existsSync(localPath)) {
    return relativePath;
  }

  if (process.env.EAS_BUILD === "true") {
    throw new Error(
      [
        `${label} is missing on EAS Build.`,
        "EAS only uploads git-tracked files; Firebase configs stay local for security.",
        "",
        "From client/, upload your real Firebase files once:",
        "  npm run eas:firebase-env",
        "",
        "Or manually:",
        `  eas env:create --name ${envVar} --type file --value ./${relativePath} --environment production`,
        `  eas env:create --name ${envVar} --type file --value ./${relativePath} --environment preview`,
      ].join("\n")
    );
  }

  return relativePath;
}

const iosGoogleServicesFile = resolveFirebaseConfigFile(
  "GOOGLE_SERVICE_INFO_PLIST",
  "GoogleService-Info.plist",
  "GoogleService-Info.plist (iOS)"
);

const androidGoogleServicesFile = resolveFirebaseConfigFile(
  "GOOGLE_SERVICES_JSON",
  "google-services.json",
  "google-services.json (Android)"
);

const appEnv =
  process.env.EXPO_PUBLIC_APP_ENV ||
  (process.env.EAS_BUILD === "true" ? "production" : "development");

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      appEnv,
    },
    ios: {
      ...appJson.expo.ios,
      googleServicesFile: iosGoogleServicesFile,
      infoPlist: {
        ...appJson.expo.ios?.infoPlist,
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      ...appJson.expo.android,
      googleServicesFile: androidGoogleServicesFile,
    },
    plugins: [
      ...(appJson.expo.plugins || []),
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: true,
          },
        },
      ],
    ],
  },
};

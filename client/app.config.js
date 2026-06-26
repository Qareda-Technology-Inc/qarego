/** Dynamic Expo config — injects .env into native Google Maps keys + dev-client plugin. */
const appJson = require("./app.json");

const googleMapsKey =
  process.env.GOOGLE_API_KEY || process.env.EXPO_PUBLIC_MAP_API_KEY || "";

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  ...appJson.expo,
  plugins: ["expo-dev-client", ...(appJson.expo.plugins || [])],
  ios: {
    ...appJson.expo.ios,
    config: {
      ...appJson.expo.ios?.config,
      googleMapsApiKey: googleMapsKey,
    },
    infoPlist: {
      ...appJson.expo.ios?.infoPlist,
      NSBonjourServices: ["_expo._tcp"],
    },
  },
  android: {
    ...appJson.expo.android,
    config: {
      ...appJson.expo.android?.config,
      googleMaps: {
        ...appJson.expo.android?.config?.googleMaps,
        apiKey: googleMapsKey,
      },
    },
  },
};

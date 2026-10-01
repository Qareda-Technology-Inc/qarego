const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Allow .m4r (iOS ringtone) as bundled asset
config.resolver.assetExts.push("m4r");

// expo-router 5 still requires("query-string") but no longer lists it.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "query-string": path.resolve(__dirname, "shims/query-string"),
};

module.exports = config;

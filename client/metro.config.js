const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const queryStringShim = path.resolve(__dirname, "shims/query-string/index.js");
const defaultResolveRequest = config.resolver.resolveRequest;

// Allow .m4r (iOS ringtone) as bundled asset
config.resolver.assetExts.push("m4r");

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "query-string": path.resolve(__dirname, "shims/query-string"),
};

// Expo's resolver can skip extraNodeModules for imports from node_modules.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "query-string") {
    return { type: "sourceFile", filePath: queryStringShim };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

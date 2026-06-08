const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Allow .m4r (iOS ringtone) as bundled asset
config.resolver.assetExts.push("m4r");

module.exports = config;

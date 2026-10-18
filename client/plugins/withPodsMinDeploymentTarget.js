const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");

// Xcode 27 only builds deployment targets from iOS 15.0 and fails the archive on any pod
// target below that (react-native-svg's RNSVGFilters resource bundle still says 12.4).
// Raise every pod target under the app's minimum (Expo SDK 53: iOS 15.1) to that minimum.
const MIN_IOS = "15.1";
const SNIPPET = `    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || current.to_f < ${MIN_IOS}
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'
        end
      end
    end`;

module.exports = function withPodsMinDeploymentTarget(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      const contents = fs.readFileSync(podfile, "utf8");
      const result = mergeContents({
        tag: "qarego-pods-min-ios",
        src: contents,
        newSrc: SNIPPET,
        anchor: /# This is necessary for Xcode 14/,
        offset: 0,
        comment: "#",
      });
      if (!result.didMerge && !result.didClear && !contents.includes("qarego-pods-min-ios")) {
        throw new Error("withPodsMinDeploymentTarget: Podfile anchor not found; update the plugin.");
      }
      fs.writeFileSync(podfile, result.contents);
      return cfg;
    },
  ]);
};

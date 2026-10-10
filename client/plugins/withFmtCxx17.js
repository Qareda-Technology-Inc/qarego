const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");

// Xcode 26's clang rejects fmt 11.0.2's consteval format strings (pinned by RN 0.79),
// failing the build in Pods/fmt/format.cc. fmt disables consteval below C++20, so
// compile only the fmt pod as C++17. Must run after react_native_post_install,
// which sets every pod to C++20.
const SNIPPET = `    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end`;

module.exports = function withFmtCxx17(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      const contents = fs.readFileSync(podfile, "utf8");
      const result = mergeContents({
        tag: "qarego-fmt-cxx17",
        src: contents,
        newSrc: SNIPPET,
        anchor: /# This is necessary for Xcode 14/,
        offset: 0,
        comment: "#",
      });
      if (!result.didMerge && !result.didClear && !contents.includes("qarego-fmt-cxx17")) {
        throw new Error("withFmtCxx17: Podfile anchor not found; update the plugin.");
      }
      fs.writeFileSync(podfile, result.contents);
      return cfg;
    },
  ]);
};

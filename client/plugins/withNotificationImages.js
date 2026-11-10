const fs = require("fs");
const path = require("path");
const { withDangerousMod, withXcodeProject } = require("expo/config-plugins");

// Adds an iOS notification service extension so promotions show their picture on iPhones
// (Android shows it without this). Switched on with IOS_NOTIFICATION_IMAGES=1 (set in eas.json
// production env, so the EAS build server adds the target too, not only the local CLI).
const EXT = "NotificationService";
const SOURCE_DIR = path.join(__dirname, "notification-service");

function infoPlist(version, buildNumber) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>${EXT}</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
  <key>CFBundleShortVersionString</key>
  <string>${version}</string>
  <key>CFBundleVersion</key>
  <string>${buildNumber}</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.usernotifications.service</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).NotificationService</string>
  </dict>
</dict>
</plist>
`;
}

/** Copy the Swift file and write the extension's Info.plist into ios/NotificationService. */
function withExtensionFiles(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, EXT);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.join(SOURCE_DIR, `${EXT}.swift`), path.join(dir, `${EXT}.swift`));
      // The extension's version must match the app's or App Store upload fails.
      const version = cfg.version || "1.0.0";
      const buildNumber = cfg.ios?.buildNumber || "1";
      fs.writeFileSync(path.join(dir, `${EXT}-Info.plist`), infoPlist(version, buildNumber));
      return cfg;
    },
  ]);
}

/** Add the extension target to the Xcode project and embed it in the app. */
function withExtensionTarget(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    if (project.pbxTargetByName(EXT)) return cfg;

    const bundleId = `${cfg.ios.bundleIdentifier}.${EXT}`;
    const group = project.addPbxGroup([`${EXT}.swift`, `${EXT}-Info.plist`], EXT, EXT);
    const groups = project.hash.project.objects.PBXGroup;
    for (const key of Object.keys(groups)) {
      const g = groups[key];
      if (typeof g === "object" && g.name === undefined && g.path === undefined) {
        project.addToPbxGroup(group.uuid, key);
      }
    }

    // The xcode package fails to add a dependency when these sections are missing.
    const objects = project.hash.project.objects;
    objects.PBXTargetDependency = objects.PBXTargetDependency || {};
    objects.PBXContainerItemProxy = objects.PBXContainerItemProxy || {};

    const target = project.addTarget(EXT, "app_extension", EXT, bundleId);
    project.addBuildPhase([`${EXT}.swift`], "PBXSourcesBuildPhase", "Sources", target.uuid);
    project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target.uuid);
    project.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", target.uuid);

    // The xcode package writes literal "undefined" for some file fields and adds the Info.plist
    // as a resource file that no build phase uses; tidy both so Xcode sees a clean target.
    const fileRefs = objects.PBXFileReference || {};
    for (const key of Object.keys(fileRefs)) {
      const ref = fileRefs[key];
      if (typeof ref !== "object") continue;
      for (const field of Object.keys(ref)) if (ref[field] === "undefined" || ref[field] === undefined) delete ref[field];
    }
    const buildFiles = objects.PBXBuildFile || {};
    for (const key of Object.keys(buildFiles)) {
      const comment = buildFiles[`${key}_comment`];
      if (typeof buildFiles[key] === "object" && comment === `${EXT}-Info.plist in Resources`) {
        delete buildFiles[key];
        delete buildFiles[`${key}_comment`];
      }
    }

    const configs = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configs)) {
      const settings = configs[key].buildSettings;
      if (!settings || settings.PRODUCT_NAME !== `"${EXT}"`) continue;
      settings.INFOPLIST_FILE = `${EXT}/${EXT}-Info.plist`;
      settings.IPHONEOS_DEPLOYMENT_TARGET = "15.1";
      settings.TARGETED_DEVICE_FAMILY = `"1,2"`;
      settings.SWIFT_VERSION = "5.0";
      settings.CODE_SIGN_STYLE = "Automatic";
      settings.MARKETING_VERSION = cfg.version || "1.0.0";
      settings.CURRENT_PROJECT_VERSION = cfg.ios?.buildNumber || "1";
      if (cfg.ios?.appleTeamId) settings.DEVELOPMENT_TEAM = cfg.ios.appleTeamId;
    }
    return cfg;
  });
}

module.exports = function withNotificationImages(config) {
  // EAS creates signing credentials for extensions listed here.
  const appExtensions = config.extra?.eas?.build?.experimental?.ios?.appExtensions || [];
  if (!appExtensions.some((e) => e.targetName === EXT)) {
    config.extra = {
      ...config.extra,
      eas: {
        ...config.extra?.eas,
        build: {
          ...config.extra?.eas?.build,
          experimental: {
            ...config.extra?.eas?.build?.experimental,
            ios: {
              ...config.extra?.eas?.build?.experimental?.ios,
              appExtensions: [
                ...appExtensions,
                { targetName: EXT, bundleIdentifier: `${config.ios.bundleIdentifier}.${EXT}` },
              ],
            },
          },
        },
      },
    };
  }
  return withExtensionTarget(withExtensionFiles(config));
};

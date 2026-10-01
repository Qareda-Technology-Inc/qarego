const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

const BLOCKED = [
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
];

function stripPermissionList(manifest, key) {
  const current = Array.isArray(manifest[key]) ? manifest[key] : [];
  const kept = current.filter((entry) => !BLOCKED.includes(entry.$?.["android:name"]));
  for (const name of BLOCKED) {
    kept.push({
      $: {
        "android:name": name,
        "tools:node": "remove",
      },
    });
  }
  manifest[key] = kept;
}

/**
 * Runs last so no later plugin can leave gallery / storage permissions in the
 * merged AndroidManifest. Play rejects targetSdk 33+ apps that declare
 * READ_MEDIA_IMAGES or READ_MEDIA_VIDEO when the system picker is enough.
 */
module.exports = function withStripPhotoPermissions(config) {
  return withAndroidManifest(config, (mod) => {
    mod.modResults = AndroidConfig.Manifest.ensureToolsAvailable(mod.modResults);
    const manifest = mod.modResults.manifest;
    stripPermissionList(manifest, "uses-permission");
    stripPermissionList(manifest, "uses-permission-sdk-23");
    return mod;
  });
};

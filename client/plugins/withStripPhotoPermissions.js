const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

const BLOCKED = [
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.READ_SMS",
  "android.permission.SEND_SMS",
  "android.permission.RECEIVE_SMS",
  "android.permission.RECEIVE_MMS",
  "android.permission.RECEIVE_WAP_PUSH",
  "android.permission.READ_CALL_LOG",
  "android.permission.WRITE_CALL_LOG",
  "android.permission.PROCESS_OUTGOING_CALLS",
  "android.permission.READ_PHONE_STATE",
  "android.permission.READ_PHONE_NUMBERS",
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
 * Strip Play-restricted permissions from the merged AndroidManifest.
 * QareGO is not a default SMS/phone handler; users type their number.
 */
module.exports = function withStripRestrictedPermissions(config) {
  return withAndroidManifest(config, (mod) => {
    mod.modResults = AndroidConfig.Manifest.ensureToolsAvailable(mod.modResults);
    const manifest = mod.modResults.manifest;
    stripPermissionList(manifest, "uses-permission");
    stripPermissionList(manifest, "uses-permission-sdk-23");
    return mod;
  });
};

/**
 * React Native New Architecture codegen writes RCTThirdPartyFabricComponentsProvider.*
 * into node_modules/react-native. Pod install deletes these files and expects codegen
 * to recreate them — if that step is skipped, iOS builds fail with "file not found".
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const iosDir = path.join(root, "ios");

if (!fs.existsSync(iosDir)) {
  process.exit(0);
}

const script = path.join(
  root,
  "node_modules/react-native/scripts/generate-codegen-artifacts.js"
);
if (!fs.existsSync(script)) {
  process.exit(0);
}

execSync(`node "${script}" -p . -o ios -t ios`, {
  cwd: root,
  stdio: "inherit",
});

/**
 * expo-router 5.1 still `require("query-string")` but does not declare it.
 * Metro looks in expo-router/node_modules first — put a CJS copy there.
 */
const fs = require("fs");
const path = require("path");

const destDir = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-router",
  "node_modules",
  "query-string"
);
const srcDir = path.join(__dirname, "..", "shims", "query-string");

if (!fs.existsSync(srcDir)) {
  console.warn("[ensure-query-string] shim missing; skip.");
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
for (const file of fs.readdirSync(srcDir)) {
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
}

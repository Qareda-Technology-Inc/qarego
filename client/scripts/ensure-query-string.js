/**
 * expo-router 5.1 still `require("query-string")` but does not declare it.
 * Metro will not use the app's extraNodeModules for imports from node_modules,
 * so we rewrite those requires to a local CJS shim inside expo-router.
 */
const fs = require("fs");
const path = require("path");

const shimSource = `"use strict";
function stringify(object) {
  if (!object || typeof object !== "object") return "";
  return Object.keys(object)
    .filter((key) => object[key] !== undefined && object[key] !== null)
    .map((key) => {
      const value = object[key];
      if (Array.isArray(value)) {
        return value
          .map((item) => encodeURIComponent(key) + "=" + encodeURIComponent(String(item)))
          .join("&");
      }
      return encodeURIComponent(key) + "=" + encodeURIComponent(String(value));
    })
    .join("&");
}
exports.stringify = stringify;
exports.parse = function parse() { return {}; };
module.exports = { stringify, parse: exports.parse };
`;

const expoRouter = path.join(__dirname, "..", "node_modules", "expo-router");
const forkDir = path.join(expoRouter, "build", "fork");

if (!fs.existsSync(forkDir)) {
  console.warn("[ensure-query-string] expo-router fork dir missing; skip.");
  process.exit(0);
}

const shimPath = path.join(forkDir, "queryStringShim.js");
fs.writeFileSync(shimPath, shimSource);

const targets = ["getPathFromState-forks.js", "getPathFromState.js"];
let patched = 0;
for (const file of targets) {
  const target = path.join(forkDir, file);
  if (!fs.existsSync(target)) continue;
  const original = fs.readFileSync(target, "utf8");
  const next = original
    .replace(/__importStar\(require\(["']query-string["']\)\)/g, '__importStar(require("./queryStringShim"))')
    .replace(/require\(["']query-string["']\)/g, 'require("./queryStringShim")');
  if (next !== original) {
    fs.writeFileSync(target, next);
    patched += 1;
  }
}

const nested = path.join(expoRouter, "node_modules", "query-string");
fs.mkdirSync(nested, { recursive: true });
fs.writeFileSync(
  path.join(nested, "package.json"),
  JSON.stringify({ name: "query-string", version: "7.1.3", main: "index.js" })
);
fs.writeFileSync(
  path.join(nested, "index.js"),
  `"use strict";
const { stringify, parse } = require("../../build/fork/queryStringShim");
module.exports = { stringify, parse };
module.exports.stringify = stringify;
module.exports.parse = parse;
`
);

console.log(`[ensure-query-string] patched ${patched} expo-router file(s)`);

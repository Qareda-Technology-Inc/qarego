/**
 * react-native-maps@1.18.0 crashes on the New Architecture (iOS) when map
 * children (Markers / Polylines) mount out of order. The legacy view-manager
 * interop can call `insertReactSubview:atIndex:` with an `atIndex` greater than
 * the map's current `_reactSubviews` count, so `insertObject:atIndex:` throws an
 * NSRangeException and the app aborts (SIGABRT) inside AIRGoogleMap /
 * AIRMap. This is aggravated by react-native-maps-directions, which mounts its
 * Polyline asynchronously after the map already has children.
 *
 * We clamp the insertion index to the array bounds so the insert can never go
 * out of range, and skip nil children. Re-applies after every `npm install`.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const targets = [
  ["node_modules", "react-native-maps", "ios", "AirGoogleMaps", "AIRGoogleMap.m"],
  ["node_modules", "react-native-maps", "ios", "AirMaps", "AIRMap.m"],
  ["ios", "Pods", "react-native-maps", "ios", "AirGoogleMaps", "AIRGoogleMap.m"],
  ["ios", "Pods", "react-native-maps", "ios", "AirMaps", "AIRMap.m"],
];

// The interop can also hand over a nil child (e.g. when a Marker mounts mid-trip as the
// courier's first location arrives); inserting nil throws NSInvalidArgumentException and
// kills the app. Skip nil children instead.
const nilSignature =
  "- (void)insertReactSubview:(id<RCTComponent>)subview atIndex:(NSInteger)atIndex {";
const nilGuard = nilSignature + "\n  if (subview == nil) { return; }";

const original = "[_reactSubviews insertObject:(UIView *)subview atIndex:(NSUInteger) atIndex];";
const patched =
  "[_reactSubviews insertObject:(UIView *)subview atIndex:MIN((NSUInteger) atIndex, _reactSubviews.count)];";

for (const parts of targets) {
  const target = path.join(root, ...parts);
  if (!fs.existsSync(target)) continue;

  let source = fs.readFileSync(target, "utf8");
  if (!source.includes(nilGuard) && source.includes(nilSignature)) {
    source = source.split(nilSignature).join(nilGuard);
    fs.writeFileSync(target, source);
    console.log(`[patch-react-native-maps] Added nil-child guard in ${parts.join("/")}.`);
  }
  if (source.includes(patched)) continue;
  if (!source.includes(original)) {
    console.warn(
      `[patch-react-native-maps] ${parts.join("/")} layout changed; skip.`
    );
    continue;
  }

  source = source.split(original).join(patched);
  fs.writeFileSync(target, source);
  console.log(`[patch-react-native-maps] Clamped insert index in ${parts.join("/")}.`);
}

/**
 * react-native-maps 1.29 imports `codegenNativeComponent` / `codegenNativeCommands` from
 * 'react-native', which only exports them from RN 0.80+. On RN 0.79 they are undefined and
 * the app crashes at load ("codegenNativeCommands is not a function"). Rewrite those imports
 * to the deep paths RN 0.79 provides. Idempotent; re-applies after every `npm install`.
 */
const deepPaths = {
  codegenNativeComponent: "react-native/Libraries/Utilities/codegenNativeComponent",
  codegenNativeCommands: "react-native/Libraries/Utilities/codegenNativeCommands",
};
const mapsSrc = path.join(root, "node_modules", "react-native-maps", "src");
const importRe = /import\s*\{([^}]*)\}\s*from\s*'react-native';/g;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx|js)$/.test(entry.name) ? [full] : [];
  });
}

let rewritten = 0;
for (const file of walk(mapsSrc)) {
  const source = fs.readFileSync(file, "utf8");
  const next = source.replace(importRe, (whole, names) => {
    const parts = names.split(",").map((n) => n.trim()).filter(Boolean);
    const deep = parts.filter((n) => deepPaths[n]);
    if (!deep.length) return whole;
    const rest = parts.filter((n) => !deepPaths[n]);
    const lines = deep.map((n) => `import ${n} from '${deepPaths[n]}';`);
    if (rest.length) lines.unshift(`import {${rest.join(", ")}} from 'react-native';`);
    return lines.join("\n");
  });
  if (next !== source) {
    fs.writeFileSync(file, next);
    rewritten += 1;
  }
}
if (rewritten) {
  console.log(`[patch-react-native-maps] Rewrote codegen imports for RN 0.79 in ${rewritten} file(s).`);
}

/**
 * Android: react-native-maps 1.29's codegen CMakeLists calls target_compile_reactnative_options,
 * a CMake helper that only exists from RN 0.80. On RN 0.79 the EAS Android build fails with
 * "Unknown CMake command". Replace it with the flags RN 0.79's own codegen uses.
 * (Drop this step after moving to RN 0.80+.)
 */
const mapsCmake = path.join(root, "node_modules", "react-native-maps", "android", "src", "main", "jni", "CMakeLists.txt");
if (fs.existsSync(mapsCmake)) {
  const cmake = fs.readFileSync(mapsCmake, "utf8");
  const call = "target_compile_reactnative_options(react_codegen_RNMapsSpecs PRIVATE)";
  if (cmake.includes(call)) {
    fs.writeFileSync(
      mapsCmake,
      cmake.replace(
        call,
        `target_compile_options(\n  react_codegen_RNMapsSpecs\n  PRIVATE\n  -DLOG_TAG=\\"ReactNative\\"\n  -fexceptions\n  -frtti\n  -std=c++20\n  -Wall\n)`
      )
    );
    console.log("[patch-react-native-maps] Replaced target_compile_reactnative_options for RN 0.79 (Android).");
  }
}

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
 * out of range. Re-applies after every `npm install`.
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

const original = "[_reactSubviews insertObject:(UIView *)subview atIndex:(NSUInteger) atIndex];";
const patched =
  "[_reactSubviews insertObject:(UIView *)subview atIndex:MIN((NSUInteger) atIndex, _reactSubviews.count)];";

for (const parts of targets) {
  const target = path.join(root, ...parts);
  if (!fs.existsSync(target)) continue;

  let source = fs.readFileSync(target, "utf8");
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

/**
 * iOS 26 added Calendar.Identifier cases that expo-localization@16.0.1 does not handle.
 * Requires Xcode 26+ to compile (EAS: eas.json ios.image "latest"). Re-applies after npm install.
 */
const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-localization",
  "ios",
  "LocalizationModule.swift"
);

const marker = "case .bangla:";
const patch = `    case .bangla:
      return "beng"
    case .gujarati:
      return "gujr"
    case .kannada:
      return "knda"
    case .malayalam:
      return "mlym"
    case .marathi:
      return "mr"
    case .odia:
      return "orya"
    case .tamil:
      return "taml"
    case .telugu:
      return "telu"
    case .vikram:
      return "vikram"
    case .dangi:
      return "dangi"
    case .vietnamese:
      return "viet"
    @unknown default:
      return "iso8601"`;

if (!fs.existsSync(target)) {
  process.exit(0);
}

let source = fs.readFileSync(target, "utf8");
if (source.includes(marker)) {
  process.exit(0);
}

const needle = `    case .iso8601:
      return "iso8601"
    }`;

if (!source.includes(needle)) {
  console.warn("[patch-expo-localization] Swift file layout changed; skip.");
  process.exit(0);
}

source = source.replace(
  needle,
  `    case .iso8601:
      return "iso8601"
${patch}
    }`
);

fs.writeFileSync(target, source);
console.log("[patch-expo-localization] Applied iOS 26 calendar identifier fix.");

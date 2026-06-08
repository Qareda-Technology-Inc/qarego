#!/usr/bin/env bash
# Writes android/local.properties (sdk.dir) so Gradle finds the Android SDK.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_PROPS="$CLIENT_DIR/android/local.properties"

resolve_android_sdk() {
  if [ -n "${ANDROID_HOME:-}" ] && [ -d "$ANDROID_HOME" ]; then
    echo "$ANDROID_HOME"
    return 0
  fi
  if [ -n "${ANDROID_SDK_ROOT:-}" ] && [ -d "$ANDROID_SDK_ROOT" ]; then
    echo "$ANDROID_SDK_ROOT"
    return 0
  fi
  case "$(uname -s)" in
    Darwin)
      if [ -d "$HOME/Library/Android/sdk" ]; then
        echo "$HOME/Library/Android/sdk"
        return 0
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      if [ -n "${LOCALAPPDATA:-}" ] && [ -d "$LOCALAPPDATA/Android/Sdk" ]; then
        echo "$LOCALAPPDATA/Android/Sdk"
        return 0
      fi
      ;;
  esac
  return 1
}

SDK_PATH="$(resolve_android_sdk || true)"
if [ -z "$SDK_PATH" ]; then
  echo "Android SDK not found."
  echo "Install Android Studio → SDK Manager, or set ANDROID_HOME to your SDK folder."
  exit 1
fi

if [ ! -d "$CLIENT_DIR/android" ]; then
  echo "ensure-android-local-props: run from client/ after expo prebuild (android/ missing)"
  exit 1
fi

sdk_dir_escaped="${SDK_PATH//\\/\\\\}"
{
  echo "## Auto-generated — do not commit. Run: scripts/ensure-android-local-props.sh"
  printf 'sdk.dir=%s\n' "$sdk_dir_escaped"
} >"$LOCAL_PROPS"

echo "Wrote $LOCAL_PROPS (sdk.dir=$SDK_PATH)"

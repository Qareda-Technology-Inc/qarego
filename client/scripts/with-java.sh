#!/usr/bin/env bash
# Use Android Studio's bundled JDK when JAVA_HOME is not set (common on fresh Macs).
# Sets ANDROID_HOME / writes android/local.properties when the SDK is installed.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="$CLIENT_DIR/android"
LOCAL_PROPS="$ANDROID_DIR/local.properties"

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
if [ -n "$SDK_PATH" ]; then
  export ANDROID_HOME="$SDK_PATH"
  export ANDROID_SDK_ROOT="$SDK_PATH"
  export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
  sdk_dir_escaped="${SDK_PATH//\\/\\\\}"
  {
    echo "## Auto-generated — do not commit"
    printf 'sdk.dir=%s\n' "$sdk_dir_escaped"
  } >"$LOCAL_PROPS"
fi

if [ -z "${JAVA_HOME:-}" ]; then
  if [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
    export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  elif [ -d "/Applications/Android Studio.app/Contents/jbr" ]; then
    export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr"
  elif command -v /usr/libexec/java_home >/dev/null 2>&1; then
    JAVA_HOME="$(/usr/libexec/java_home 2>/dev/null || true)"
    export JAVA_HOME
  fi
fi

if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "No JDK found."
  echo "Install Android Studio, or: brew install openjdk@17"
  echo "Then set JAVA_HOME, e.g.:"
  echo '  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"'
  exit 1
fi

export PATH="$JAVA_HOME/bin:$PATH"
exec "$@"

#!/usr/bin/env bash
# Resolve adb when it is not on PATH (common on Mac).
set -e

if command -v adb >/dev/null 2>&1; then
  exec adb "$@"
fi

for candidate in \
  "${ANDROID_HOME:-}/platform-tools/adb" \
  "${ANDROID_SDK_ROOT:-}/platform-tools/adb" \
  "$HOME/Library/Android/sdk/platform-tools/adb"; do
  if [ -x "$candidate" ]; then
    exec "$candidate" "$@"
  fi
done

echo "adb not found. Install Android SDK platform-tools or Android Studio."
echo "Then add to ~/.zshrc:"
echo '  export PATH="$HOME/Library/Android/sdk/platform-tools:$PATH"'
exit 1

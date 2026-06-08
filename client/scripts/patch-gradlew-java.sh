#!/usr/bin/env bash
# Ensures android/gradlew can find Java on macOS without JAVA_HOME in the shell.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GRADLEW="$SCRIPT_DIR/../android/gradlew"
MARKER="QareGO: use Android Studio JDK"
SNIPPET="$SCRIPT_DIR/gradlew-java-snippet.sh"

if [ ! -f "$GRADLEW" ]; then
  echo "patch-gradlew-java: android/gradlew not found (run expo prebuild first)"
  exit 0
fi

if grep -q "$MARKER" "$GRADLEW"; then
  exit 0
fi

TMP="$(mktemp)"
while IFS= read -r line || [ -n "$line" ]; do
  if [ "$line" = "# Determine the Java command to use to start the JVM." ]; then
    cat "$SNIPPET"
  fi
  printf '%s\n' "$line"
done <"$GRADLEW" >"$TMP"
mv "$TMP" "$GRADLEW"
chmod +x "$GRADLEW"
echo "patch-gradlew-java: patched android/gradlew"

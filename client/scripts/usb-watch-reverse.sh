#!/usr/bin/env bash
# Re-applies adb reverse when you unplug/replug USB (run once in a terminal tab).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REVERSE="$ROOT/scripts/usb-reverse.sh"
chmod +x "$REVERSE" 2>/dev/null || true

echo "Watching for Android USB — will re-run port forward every 3s (Ctrl+C to stop)"
while true; do
  "$REVERSE" 2>/dev/null || true
  sleep 3
done

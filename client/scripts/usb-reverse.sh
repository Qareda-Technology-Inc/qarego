#!/usr/bin/env bash
# Forward phone localhost ports to your Mac (USB debugging).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADB="$ROOT/scripts/adb.sh"
chmod +x "$ADB" 2>/dev/null || true

if ! "$ADB" get-state >/dev/null 2>&1; then
  echo "No Android device — skip USB reverse (plug in phone for Android dev)."
  exit 0
fi

echo "USB tunnel (phone 127.0.0.1 → Mac API + Metro):"
if ! "$ADB" reverse tcp:2026 tcp:2026 || ! "$ADB" reverse tcp:8081 tcp:8081; then
  echo "WARNING: adb reverse failed — API calls from the phone will fail over USB."
  echo "         Replug the device or run: cd client && npm run usb:reverse"
  exit 1
fi
"$ADB" reverse --list
echo "OK — start the app with: cd client && npm start"

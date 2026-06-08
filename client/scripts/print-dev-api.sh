#!/usr/bin/env bash
# Prints your Mac LAN IP so the physical phone can reach the API.
set -e
PORT="${API_PORT:-2026}"

pick_ip() {
  for iface in en0 en1 en2 bridge0 awdl0; do
    ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
    if [ -n "$ip" ]; then
      echo "$ip"
      return 0
    fi
  done
  # Fallback when ipconfig has no address (e.g. sandbox or unusual network)
  if command -v route >/dev/null 2>&1; then
    ip=$(route -n get default 2>/dev/null | awk '/interface:/{iface=$2} END{if(iface) print iface}' | xargs -I{} ipconfig getifaddr {} 2>/dev/null || true)
    if [ -n "$ip" ]; then
      echo "$ip"
      return 0
    fi
  fi
  return 1
}

IP=$(pick_ip || true)
if [ -z "$IP" ]; then
  echo "Could not detect LAN IP. Connect Wi‑Fi, then run: ifconfig | grep 'inet '"
  exit 1
fi

echo ""
echo "Physical Android/iOS cannot use 127.0.0.1 unless you run USB reverse."
echo ""
echo "Recommended — add to client/.env (phone + Mac on same Wi‑Fi):"
echo ""
echo "  EXPO_PUBLIC_API_URL=http://${IP}:${PORT}"
echo ""
echo "Then restart Metro:  cd client && npx expo start -c"
echo ""
echo "Test from phone browser:  http://${IP}:${PORT}/health"
echo ""
echo "USB-only (no .env change):"
echo "  npm start   ← runs usb:reverse automatically"
echo "  npm run usb:watch   ← optional: re-forward after unplug/replug"
echo "  (API stays http://127.0.0.1:${PORT} on the phone)"
echo ""

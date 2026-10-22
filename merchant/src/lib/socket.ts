import { io, type Socket } from "socket.io-client";
import { resolveBackendOrigin } from "@/lib/backendUrl";
import { renewSession } from "@/lib/api";

let socket: Socket | null = null;

/** Singleton socket authenticated with the merchant/cook access token. */
export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;

  const socketUrl = resolveBackendOrigin();

  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(socketUrl, {
    transports: ["websocket", "polling"],
    // Read on every (re)connect, so a renewed token is used.
    auth: (cb) => cb({ access_token: localStorage.getItem("accessToken") }),
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  // The server refuses an expired token, and socket.io doesn't retry a refused handshake:
  // renew the session, then connect again.
  const s = socket;
  s.on("connect_error", (err) => {
    if (!String(err?.message || "").startsWith("Authentication invalid")) return;
    renewSession()
      .then((fresh) => {
        if (fresh && socket === s) s.connect();
      })
      .catch(() => {
        if (socket === s) setTimeout(() => s.connect(), 5000);
      });
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

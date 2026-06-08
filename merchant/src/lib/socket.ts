import { io, type Socket } from "socket.io-client";
import { resolveBackendOrigin } from "@/lib/backendUrl";

let socket: Socket | null = null;

/** Singleton socket authenticated with the merchant/cook access token. */
export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;

  const socketUrl = resolveBackendOrigin();

  if (socket) {
    socket.auth = { access_token: token };
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(socketUrl, {
    transports: ["websocket", "polling"],
    auth: { access_token: token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

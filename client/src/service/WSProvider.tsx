import { tokenStorage } from "@/store/storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { io, Socket } from "socket.io-client";
import { getSocketUrl } from "./config";
import { refresh_tokens } from "./apiInterceptors";
import { markOffline, markOnline } from "./connectivity";
import { useRiderStore } from "@/store/riderStore";

interface WSService {
  initializeSocket: () => void;
  emit: (event: string, data?: any) => void;
  /** Send only if connected; dropped while offline instead of queued (e.g. live location). */
  emitIfConnected: (event: string, data?: any) => void;
  on: (event: string, cb: (data: any) => void) => void;
  off: (event: string, cb?: (data: any) => void) => void;
  removeListener: (listenerName: string) => void;
  updateAccessToken: () => void;
  disconnect: () => void;
  /** Increments on each socket connect/reconnect — use to re-join rooms. */
  connectNonce: number;
}

const WSContext = createContext<WSService | undefined>(undefined);

export const WSProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [socketAccessToken, setSocketAccessToken] = useState<string | null>(
    null
  );
  const [connectNonce, setConnectNonce] = useState(0);
  const socket = useRef<Socket | undefined>(undefined);
  const refreshingRef = useRef(false);

  useEffect(() => {
    const token = tokenStorage.getString("access_token") as any;
    setSocketAccessToken(token);
  }, []);

  useEffect(() => {
    if (socketAccessToken) {
      if (socket.current) {
        socket.current.disconnect();
      }

      socket.current = io(getSocketUrl(), {
        transports: ["websocket", "polling"],
        withCredentials: true,
        // Read the token on every (re)connect so a refreshed token is picked up without
        // replacing the socket (screens' listeners live on this instance).
        auth: (cb) => {
          cb({ access_token: tokenStorage.getString("access_token") || socketAccessToken || "" });
        },
        extraHeaders: {
          access_token: socketAccessToken || "",
        },
      });

      // The server rejects expired tokens with "Authentication invalid: ...", after which
      // socket.io stops retrying. Refresh, then reconnect this same socket.
      socket.current.on("connect_error", (error) => {
        if (!/authentication/i.test(error?.message || "")) {
          markOffline();
          return;
        }
        if (refreshingRef.current) return;
        refreshingRef.current = true;
        refresh_tokens()
          .then(() => {
            if (tokenStorage.getString("access_token")) socket.current?.connect();
          })
          .catch(() => {
            /* offline: socket.io keeps retrying; the session is kept */
          })
          .finally(() => {
            refreshingRef.current = false;
          });
      });

      socket.current.on("connect", () => {
        markOnline();
        setConnectNonce((n) => n + 1);
        const { onDuty, location } = useRiderStore.getState();
        if (onDuty && location) {
          const latest = {
            latitude: location.latitude,
            longitude: location.longitude,
            heading: location.heading ?? 0,
          };
          socket.current?.emit("goOnDuty", latest);
          // Positions taken while offline were dropped, so share where the rider is now.
          socket.current?.emit("updateLocation", latest);
        }
      });
    }

    return () => {
      socket.current?.disconnect();
    };
  }, [socketAccessToken]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const token = tokenStorage.getString("access_token") as string | undefined;
      if (token && !socket.current) {
        setSocketAccessToken(token);
      } else if (token && socket.current && !socket.current.connected) {
        // Reuse the socket (auth reads the latest token) so screen listeners survive.
        socket.current.connect();
      }
      const { onDuty, location } = useRiderStore.getState();
      if (onDuty && location && socket.current?.connected) {
        socket.current.emit("goOnDuty", {
          latitude: location.latitude,
          longitude: location.longitude,
          heading: location.heading ?? 0,
        });
      }
    });
    return () => sub.remove();
  }, [socketAccessToken]);

  const emit = useCallback((event: string, data: any = {}) => {
    socket.current?.emit(event, data);
  }, []);

  const emitIfConnected = useCallback((event: string, data: any = {}) => {
    socket.current?.volatile.emit(event, data);
  }, []);

  const on = useCallback((event: string, cb: (data: any) => void) => {
    socket.current?.on(event, cb);
  }, []);

  const off = useCallback((event: string, cb?: (data: any) => void) => {
    if (cb) socket.current?.off(event, cb);
    else socket.current?.off(event);
  }, []);

  const removeListener = useCallback((listenerName: string) => {
    socket?.current?.removeListener(listenerName);
  }, []);

  const disconnect = useCallback(() => {
    if (socket.current) {
      socket.current.disconnect();
      socket.current = undefined;
    }
  }, []);

  const updateAccessToken = useCallback(() => {
    const token = tokenStorage.getString("access_token") as any;
    setSocketAccessToken(token);
  }, []);

  const socketService: WSService = {
    initializeSocket: () => {},
    emit,
    emitIfConnected,
    off,
    on,
    disconnect,
    removeListener,
    updateAccessToken,
    connectNonce,
  };

  return (
    <WSContext.Provider value={socketService}>{children}</WSContext.Provider>
  );
};

export const useWS = (): WSService => {
  const socketService = useContext(WSContext);
  if (!socketService) {
    throw new Error("useWS must be used within a WSProvider");
  }
  return socketService;
};

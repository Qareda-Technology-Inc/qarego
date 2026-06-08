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
import { useRiderStore } from "@/store/riderStore";

interface WSService {
  initializeSocket: () => void;
  emit: (event: string, data?: any) => void;
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
  const socket = useRef<Socket>();

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
        auth: {
          access_token: socketAccessToken || "",
        },
        extraHeaders: {
          access_token: socketAccessToken || "",
        },
      });

      socket.current.on("connect_error", (error) => {
        if (error.message === "Authentication error") {
          console.log("Auth connection error: ", error.message);
          refresh_tokens().then(() => {
            const token = tokenStorage.getString("access_token") as string | undefined;
            if (token) setSocketAccessToken(token);
          });
        }
      });

      socket.current.on("connect", () => {
        setConnectNonce((n) => n + 1);
        const { onDuty, location } = useRiderStore.getState();
        if (onDuty && location) {
          socket.current?.emit("goOnDuty", {
            latitude: location.latitude,
            longitude: location.longitude,
            heading: location.heading ?? 0,
          });
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
      if (token && token !== socketAccessToken) {
        setSocketAccessToken(token);
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

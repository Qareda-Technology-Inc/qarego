"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getSocket } from "@/lib/socket";
import { fetcher } from "@/lib/api";
import { playNewOrderRing, stopNewOrderRing } from "@/lib/sound";
import { showBrowserOrderNotification } from "@/lib/browserNotifications";

type OrderRef = { _id: string; status?: string; customer?: { name?: string } };

async function hasPendingPlacedOrders(): Promise<boolean> {
  try {
    const data = await fetcher("/merchant/orders");
    return (data.orders || []).some((o: OrderRef) => o.status === "PLACED");
  } catch {
    return false;
  }
}

/**
 * Global kitchen alerts: socket, looping new-order sound until accept/decline, toast.
 */
export function KitchenAlerts() {
  const pathname = usePathname();
  const { user, activeRestaurantId } = useAuth();
  const [toast, setToast] = useState<string | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  const ringingRef = useRef(false);

  const isLogin = pathname === "/login";

  const stopRingIfNoPending = useCallback(async () => {
    const pending = await hasPendingPlacedOrders();
    if (!pending) {
      stopNewOrderRing();
      ringingRef.current = false;
    }
  }, []);

  const startRing = useCallback(() => {
    ringingRef.current = true;
    void playNewOrderRing();
  }, []);

  useEffect(() => {
    if (isLogin || !user || !activeRestaurantId) return;

    knownIdsRef.current = new Set();
    seededRef.current = false;

    const socket = getSocket();
    if (!socket) return;

    const subscribe = () => {
      socket.emit("subscribeRestaurant", activeRestaurantId);
    };
    const onSocketError = (payload: { message?: string }) => {
      if (payload?.message?.includes("restaurant")) {
        console.warn("[kitchen] socket:", payload.message);
      }
    };

    if (socket.connected) subscribe();
    socket.on("connect", subscribe);
    socket.on("error", onSocketError);

    const notifyNew = (message: string, order?: OrderRef) => {
      startRing();
      setToast(message);
      showBrowserOrderNotification("New order", message);
      window.dispatchEvent(
        new CustomEvent("kitchen:new-order", { detail: order ?? null })
      );
      window.dispatchEvent(new CustomEvent("kitchen:orders-changed"));
    };

    const onNewFoodOrder = (order: OrderRef) => {
      const id = order?._id;
      if (id && knownIdsRef.current.has(id)) return;
      if (id) knownIdsRef.current.add(id);
      notifyNew(`New order from ${order?.customer?.name || "a customer"}`, order);
    };

    const onFoodOrderUpdated = () => {
      window.dispatchEvent(new CustomEvent("kitchen:orders-changed"));
      void stopRingIfNoPending();
    };

    socket.on("newFoodOrder", onNewFoodOrder);
    socket.on("foodOrderUpdated", onFoodOrderUpdated);

    const onOrderHandled = () => {
      void stopRingIfNoPending();
    };
    window.addEventListener("kitchen:order-handled", onOrderHandled);

    const seedKnown = async () => {
      try {
        const data = await fetcher("/merchant/orders");
        const orders: OrderRef[] = data.orders || [];
        orders.forEach((o) => {
          if (o._id) knownIdsRef.current.add(o._id);
        });
        seededRef.current = true;
        if (orders.some((o) => o.status === "PLACED")) {
          startRing();
          setToast("New order waiting — accept or decline");
        }
      } catch {
        /* ignore */
      }
    };
    seedKnown();

    const poll = setInterval(async () => {
      if (!seededRef.current) return;
      try {
        const data = await fetcher("/merchant/orders");
        const placed = (data.orders || []).filter(
          (o: OrderRef) => o.status === "PLACED"
        );
        let foundNew = false;
        for (const o of placed) {
          if (o._id && !knownIdsRef.current.has(o._id)) {
            knownIdsRef.current.add(o._id);
            foundNew = true;
          }
        }
        if (foundNew) {
          notifyNew("New order waiting for acceptance");
        } else if (placed.length === 0) {
          stopNewOrderRing();
          ringingRef.current = false;
        }
      } catch {
        /* ignore */
      }
    }, 5000);

    return () => {
      window.removeEventListener("kitchen:order-handled", onOrderHandled);
      socket.off("connect", subscribe);
      socket.off("error", onSocketError);
      socket.off("newFoodOrder", onNewFoodOrder);
      socket.off("foodOrderUpdated", onFoodOrderUpdated);
      if (activeRestaurantId) {
        socket.emit("unsubscribeRestaurant", activeRestaurantId);
      }
      clearInterval(poll);
      stopNewOrderRing();
    };
  }, [activeRestaurantId, user, isLogin, startRing, stopRingIfNoPending]);

  if (isLogin) return null;

  return (
    <>
      {toast && (
        <div
          className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 flex items-center gap-3 rounded-lg bg-orange-500 text-white px-4 py-3 shadow-lg"
          role="alert"
        >
          <Bell className="h-5 w-5 shrink-0 animate-pulse" />
          <span className="font-medium flex-1">{toast}</span>
          <span className="text-xs text-orange-100 shrink-0">Accept or decline to stop</span>
        </div>
      )}
    </>
  );
}

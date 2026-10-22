import { useEffect, useRef, useState } from "react";
import { router, usePathname } from "expo-router";
import { jwtDecode } from "jwt-decode";
import type { NotificationResponse } from "expo-notifications";
import { tokenStorage } from "@/store/storage";
import {
  isNativePushModuleAvailable,
  loadNotifications,
  refreshPushRegistration,
} from "@/service/pushNotifications";

type PushTarget = { id: string; type: string; rideId?: string; orderId?: string };

/** Push data arrives as strings; on Android it can sit on the FCM message instead of content. */
function targetFromResponse(response: NotificationResponse | null | undefined): PushTarget | null {
  const request = response?.notification?.request;
  if (!request) return null;
  // The last tap can be reported again on a later launch; ignore old ones.
  const sentAt = Number(response?.notification?.date) || 0;
  if (sentAt && Date.now() - (sentAt < 1e12 ? sentAt * 1000 : sentAt) > 30 * 60 * 1000) return null;
  const trigger = request.trigger as { remoteMessage?: { data?: Record<string, unknown> } } | null;
  const data = { ...(trigger?.remoteMessage?.data ?? {}), ...(request.content?.data ?? {}) } as Record<
    string,
    unknown
  >;
  const type = typeof data.type === "string" ? data.type : "";
  if (!type) return null;
  return {
    id: request.identifier,
    type,
    rideId: typeof data.rideId === "string" ? data.rideId : undefined,
    orderId: typeof data.orderId === "string" ? data.orderId : undefined,
  };
}

function signedInRole(): string | null {
  const token = tokenStorage.getString("access_token");
  if (!token) return null;
  try {
    return jwtDecode<{ role?: string }>(token)?.role ?? null;
  } catch {
    return null;
  }
}

/**
 * Registers the FCM token when the user is logged in, and opens the right screen when a
 * notification is tapped. Mount once inside the app root.
 */
export function PushNotificationBootstrap() {
  const registered = useRef(false);
  const handled = useRef(new Set<string>());
  const [pending, setPending] = useState<PushTarget | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!isNativePushModuleAvailable()) return;

    const token = tokenStorage.getString("access_token");
    if (!token) return;

    registered.current = true;
    void refreshPushRegistration().catch(() => {
      registered.current = false;
    });

    return () => {
      registered.current = false;
    };
  }, []);

  // Taps: the one that launched the app (cold start) and any while it is running.
  useEffect(() => {
    if (!isNativePushModuleAvailable()) return;
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    void (async () => {
      const Notifications = await loadNotifications();
      if (!Notifications || cancelled) return;
      const take = (response: NotificationResponse | null | undefined) => {
        const target = targetFromResponse(response);
        if (target && !handled.current.has(target.id)) setPending(target);
      };
      try {
        take(await Notifications.getLastNotificationResponseAsync());
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      sub = Notifications.addNotificationResponseReceivedListener(take);
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  // Wait until the splash screen has done its own routing, then open the target.
  useEffect(() => {
    if (!pending) return;
    if (!pathname || pathname === "/") return;
    handled.current.add(pending.id);
    setPending(null);

    const role = signedInRole();
    if (pending.type === "food_order" && pending.orderId && role === "customer") {
      const path = `/customer/stores/order/${pending.orderId}`;
      if (pathname !== path) router.push(path as never);
      return;
    }
    if (pending.type === "ride_offer" && role === "rider") {
      // Offers show on the home screen. Never pull a rider out of a trip they're on.
      if (!pathname.startsWith("/rider/liveride") && pathname !== "/rider/home") {
        router.navigate("/rider/home");
      }
      return;
    }
    if (pending.type === "rider_wallet" && role === "rider") {
      // Delivery pay sent to MoMo or added to the wallet. Don't interrupt a trip.
      if (!pathname.startsWith("/rider/liveride") && pathname !== "/rider/earnings") {
        router.push("/rider/earnings" as never);
      }
    }
  }, [pending, pathname]);

  return null;
}

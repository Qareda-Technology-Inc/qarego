"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ensureBrowserNotificationPermission } from "@/lib/browserNotifications";
import { registerMerchantWebPush } from "@/lib/webPush";

/** Requests browser notification permission and registers FCM web token when configured. */
export function PushNotificationBootstrap() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || pathname === "/login" || !user) return;

    void (async () => {
      await ensureBrowserNotificationPermission();
      await registerMerchantWebPush();
    })();
  }, [loading, pathname, user]);

  return null;
}

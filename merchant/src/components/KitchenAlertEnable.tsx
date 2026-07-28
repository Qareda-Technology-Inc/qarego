"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BellRing } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  autoEnableRestaurantAudio,
  isRestaurantAudioUnlocked,
} from "@/lib/sound";
import {
  canUseBrowserNotifications,
  ensureBrowserNotificationPermission,
} from "@/lib/browserNotifications";
import { getSocket } from "@/lib/socket";
import { registerMerchantWebPush } from "@/lib/webPush";
import { getCommerceOrderCopy } from "@/lib/commerceOrderCopy";

/**
 * Kitchen staff must tap once so the browser allows audio + desktop notifications.
 */
export function KitchenAlertEnable() {
  const pathname = usePathname();
  const { user, loading, activeRestaurantId, activeRestaurant } = useAuth();
  const copy = getCommerceOrderCopy(activeRestaurant?.vertical);
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (loading || pathname === "/login" || !user || !activeRestaurantId) {
      setVisible(false);
      return;
    }

    const needsAudio = !isRestaurantAudioUnlocked();
    const needsNotifications =
      canUseBrowserNotifications() && Notification.permission === "default";
    setVisible(needsAudio || needsNotifications);
  }, [loading, pathname, user, activeRestaurantId]);

  if (!visible) return null;

  const enable = async () => {
    setEnabling(true);
    try {
      await autoEnableRestaurantAudio();
      await ensureBrowserNotificationPermission();
      await registerMerchantWebPush();
      const socket = getSocket();
      if (socket && activeRestaurantId) {
        socket.emit("subscribeRestaurant", activeRestaurantId);
      }
      setVisible(false);
    } finally {
      setEnabling(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 rounded-2xl border border-brand/20 bg-white px-4 py-3 shadow-lg">
      <div className="flex items-start gap-3">
        <BellRing className="h-5 w-5 text-brand shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">{copy.enableAlertsTitle}</p>
          <p className="text-sm text-muted mt-1">{copy.enableAlertsBody}</p>
          <button
            type="button"
            onClick={() => void enable()}
            disabled={enabling}
            className="mt-3 inline-flex items-center rounded-xl bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {enabling ? "Enabling…" : "Enable alerts"}
          </button>
        </div>
      </div>
    </div>
  );
}

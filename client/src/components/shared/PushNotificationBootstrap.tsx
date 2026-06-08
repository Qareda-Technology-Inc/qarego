import { useEffect, useRef } from "react";
import { tokenStorage } from "@/store/storage";
import {
  isNativePushModuleAvailable,
  refreshPushRegistration,
} from "@/service/pushNotifications";

/** Registers FCM token when user is logged in. Mount once inside app root. */
export function PushNotificationBootstrap() {
  const registered = useRef(false);

  useEffect(() => {
    if (!isNativePushModuleAvailable()) return;

    const token = tokenStorage.getString("access_token");
    if (!token || registered.current) return;

    registered.current = true;
    void refreshPushRegistration().catch(() => {
      registered.current = false;
    });
  }, []);

  return null;
}

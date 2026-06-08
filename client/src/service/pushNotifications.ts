import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import * as Device from "expo-device";
import { appAxios } from "./apiInterceptors";
import { tokenStorage } from "@/store/storage";

type NotificationsModule = typeof import("expo-notifications");

/**
 * Expo modules register via JSI (requireNativeModule), not legacy NativeModules.
 * Checking NativeModules.ExpoPushTokenManager is wrong on New Architecture (NOBRIDGE).
 */
export function isNativePushModuleAvailable(): boolean {
  return !!requireOptionalNativeModule("ExpoPushTokenManager");
}

function resolveNotificationsModule(
  loaded: Awaited<ReturnType<typeof import("expo-notifications")>>
): NotificationsModule | null {
  const mod = loaded as NotificationsModule & { default?: NotificationsModule };
  if (typeof mod.setNotificationHandler === "function") return mod;
  if (mod.default && typeof mod.default.setNotificationHandler === "function") {
    return mod.default;
  }
  return null;
}

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (!isNativePushModuleAvailable()) {
    return null;
  }
  try {
    const loaded = await import("expo-notifications");
    return resolveNotificationsModule(loaded);
  } catch {
    return null;
  }
}

let handlerInstalled = false;

async function ensureNotificationHandler(Notifications: NotificationsModule) {
  if (handlerInstalled) return;
  if (typeof Notifications.setNotificationHandler !== "function") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  handlerInstalled = true;
}

function canObtainPushToken(): boolean {
  if (Device.isDevice) return true;
  if (__DEV__ && Platform.OS === "android") {
    return true;
  }
  return false;
}

export function getPushRebuildInstructions(): string {
  if (__DEV__ && Platform.OS === "android" && !Device.isDevice) {
    return (
      "Push on the Android emulator needs a Google Play system image and a dev build.\n\n" +
      "Use a physical phone for reliable FCM testing:\n" +
      "  cd client && npm run android:device\n\n" +
      "Emulator: use an AVD with the Play Store icon, then npm run android:emulator."
    );
  }
  return (
    "Push native code is missing from this install.\n\n" +
    "cd client && npm run android:rebuild\n\n" +
    "Uninstall the old QareGO app first, then install the new build."
  );
}

/** Call after login so the FCM token is saved while the JWT exists. */
export async function refreshPushRegistration(): Promise<string | null> {
  return registerForPushNotifications();
}

export async function registerForPushNotifications(): Promise<string | null> {
  const accessToken = tokenStorage.getString("access_token");
  if (!accessToken) return null;

  if (!isNativePushModuleAvailable()) {
    return null;
  }

  const Notifications = await loadNotifications();
  if (!Notifications) {
    return null;
  }

  if (!canObtainPushToken()) {
    return null;
  }

  try {
    await ensureNotificationHandler(Notifications);

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "QareGO",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#2563eb",
      });
    }

    const deviceToken = await Notifications.getDevicePushTokenAsync();
    const fcmToken = deviceToken?.data;
    if (!fcmToken) {
      throw new Error("FCM token was empty");
    }

    const { data } = await appAxios.post<{
      firebaseConfigured?: boolean;
    }>("/notifications/register-token", {
      token: fcmToken,
      provider: "fcm",
      platform: Platform.OS,
    });

    if (__DEV__) {
      console.log(
        `[push] FCM registered firebase=${data?.firebaseConfigured ?? "?"} emulator=${!Device.isDevice}`
      );
    }

    return fcmToken;
  } catch {
    return null;
  }
}

export async function unregisterPushNotifications(token: string | null) {
  if (!token) return;
  try {
    await appAxios.delete("/notifications/register-token", { data: { token } });
  } catch {
    /* ignore */
  }
}

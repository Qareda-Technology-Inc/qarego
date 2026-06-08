import { fetcher } from "@/lib/api";
import { ensureBrowserNotificationPermission } from "@/lib/browserNotifications";

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
};

function readFirebaseConfig(): FirebaseConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !messagingSenderId || !appId) {
    return null;
  }
  return { apiKey, authDomain, projectId, messagingSenderId, appId };
}

function hasVapidKey(): boolean {
  return !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
}

/** Register FCM web token so server push reaches the merchant browser when the tab is closed. */
export async function registerMerchantWebPush(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  const config = readFirebaseConfig();
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
  if (!config || !vapidKey) return null;

  const permission = await ensureBrowserNotificationPermission();
  if (permission !== "granted") return null;

  try {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");

    if (!(await isSupported())) return null;

    const app = getApps().length ? getApps()[0]! : initializeApp(config);
    const messaging = getMessaging(app);

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const worker =
      registration.installing || registration.waiting || registration.active;
    worker?.postMessage({ firebaseConfig: config });
    await navigator.serviceWorker.ready;
    registration.active?.postMessage({ firebaseConfig: config });
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;

    await fetcher("/notifications/register-token", {
      method: "POST",
      body: JSON.stringify({
        token,
        provider: "fcm",
        platform: "web",
      }),
    });

    return token;
  } catch {
    return null;
  }
}

/** Browser push-style alerts for the merchant kitchen web app (tab open or in background). */

export function canUseBrowserNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function ensureBrowserNotificationPermission(): Promise<NotificationPermission | null> {
  if (!canUseBrowserNotifications()) return null;
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showBrowserOrderNotification(title: string, body: string) {
  if (!canUseBrowserNotifications() || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, {
      body,
      tag: "qarego-new-order",
      requireInteraction: true,
    });
    notification.onclick = () => {
      window.focus();
      if (!window.location.pathname.startsWith("/orders")) {
        window.location.href = "/orders";
      }
      notification.close();
    };
  } catch {
    /* ignore — toast + audio still alert staff */
  }
}

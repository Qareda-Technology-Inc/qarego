/* eslint-disable no-undef */
/**
 * FCM background handler for the merchant kitchen web app.
 * Config is injected at runtime via postMessage from the main app.
 */
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js");

let messaging = null;

self.addEventListener("message", (event) => {
  const config = event.data?.firebaseConfig;
  if (!config || messaging) return;
  firebase.initializeApp(config);
  messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "New order";
    const body = payload.notification?.body || "Open kitchen to accept";
    self.registration.showNotification(title, {
      body,
      icon: "/favicon.ico",
      tag: "qarego-new-order",
      data: payload.data || {},
    });
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/orders");
      }
    })
  );
});

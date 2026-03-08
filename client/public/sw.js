/**
 * Service Worker for ABRWF PWA
 * Handles server-side Web Push notifications (VAPID)
 * Works on iOS PWA (16.4+) and Android Chrome
 */

const CACHE_NAME = "abrwf-v2";

// Install event - activate immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate event - claim all clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Push event - show notification from server-side push
self.addEventListener("push", (event) => {
  console.log("[SW] Push received:", event);

  let data = {
    title: "ABRWF",
    body: "Nova notificação",
    icon: "/logo-abrwf.png",
    data: { url: "/salao/mesas" },
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data.title = payload.title || data.title;
      data.body = payload.body || data.body;
      data.icon = payload.icon || data.icon;
      data.data = payload.data || data.data;
    } catch (e) {
      console.error("[SW] Error parsing push data:", e);
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.icon,
    tag: "salon-ready-" + Date.now(),
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200, 100, 200],
    data: data.data,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click - navigate to the relevant page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/salao/mesas";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          client.postMessage({ type: "NAVIGATE", url: targetUrl });
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Message event - receive messages from the main app (fallback for local notifications)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, body, tag } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: "/logo-abrwf.png",
      badge: "/logo-abrwf.png",
      tag: tag || "salon-ready",
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200, 100, 200],
    });
  }
});

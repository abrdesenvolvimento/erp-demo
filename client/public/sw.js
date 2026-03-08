/**
 * Service Worker for ABRWF PWA
 * Handles push notifications for iOS (requires PWA mode - Add to Home Screen)
 * and provides offline caching for core assets.
 */

const CACHE_NAME = "abrwf-v1";

// Install event - cache core assets
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate event - clean up old caches
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

// Push event - show notification when push message received
self.addEventListener("push", (event) => {
  let data = { title: "ABRWF", body: "Nova notificação", tag: "abrwf-push" };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/logo-abrwf.png",
    badge: "/logo-abrwf.png",
    tag: data.tag || "abrwf-push",
    requireInteraction: data.requireInteraction ?? true,
    silent: false,
    data: data,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click - focus the app window
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow("/salao/mesas");
      }
    })
  );
});

// Message event - receive messages from the main app
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
    });
  }
});

/**
 * Web Push Notification utility for the salon module.
 *
 * TWO modes of operation:
 * 1. **Server-side push (VAPID)**: The server sends push messages via web-push library.
 *    The Service Worker receives them and shows notifications even when the app is closed.
 *    This is the PRIMARY mode — works on iOS PWA 16.4+ and Android Chrome.
 *
 * 2. **Local fallback**: For browsers that don't support push subscriptions,
 *    falls back to SW.showNotification() or new Notification().
 *
 * Persistence: uses localStorage keys to remember state across page navigations.
 */

const STORAGE_KEY_PUSH = "salon_push_granted";
const STORAGE_KEY_SUBSCRIPTION = "salon_push_subscribed";

// VAPID public key from environment
const VAPID_PUBLIC_KEY = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY || "";

/**
 * Convert a base64 URL-safe string to a Uint8Array (for applicationServerKey).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if the browser supports the Notification API.
 */
export function isNotificationSupported(): boolean {
  return "Notification" in window;
}

/**
 * Check if the browser supports Push Manager (server-side push).
 */
export function isPushManagerSupported(): boolean {
  return "PushManager" in window && "serviceWorker" in navigator;
}

/**
 * Get the active Service Worker registration.
 */
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    return reg ?? null;
  } catch {
    return null;
  }
}

/**
 * Read persisted push permission from localStorage.
 */
export function getPushGrantedFromStorage(): boolean {
  try {
    if (!isNotificationSupported()) return false;
    if (Notification.permission !== "granted") {
      localStorage.removeItem(STORAGE_KEY_PUSH);
      return false;
    }
    return localStorage.getItem(STORAGE_KEY_PUSH) === "true";
  } catch {
    return false;
  }
}

/**
 * Check if we already have an active push subscription stored.
 */
export function isAlreadySubscribed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_SUBSCRIPTION) === "true";
  } catch {
    return false;
  }
}

/**
 * Request notification permission.
 * Must be called from a user gesture (button click).
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    console.warn("[Push] Notifications not supported in this browser");
    return "denied";
  }

  if (Notification.permission === "granted") {
    try { localStorage.setItem(STORAGE_KEY_PUSH, "true"); } catch { /* ignore */ }
    return "granted";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  try {
    const result = await Notification.requestPermission();
    if (result === "granted") {
      try { localStorage.setItem(STORAGE_KEY_PUSH, "true"); } catch { /* ignore */ }
    }
    return result;
  } catch {
    return "denied";
  }
}

/**
 * Check if notifications are currently permitted.
 */
export function isNotificationPermitted(): boolean {
  return isNotificationSupported() && Notification.permission === "granted";
}

/**
 * Subscribe to server-side push notifications via VAPID.
 * Returns the PushSubscription object to send to the server, or null if failed.
 */
export async function subscribeToPush(): Promise<PushSubscriptionJSON | null> {
  if (!isPushManagerSupported() || !VAPID_PUBLIC_KEY) {
    console.warn("[Push] PushManager not supported or VAPID key missing");
    return null;
  }

  try {
    const swReg = await getServiceWorkerRegistration();
    if (!swReg) {
      console.warn("[Push] No Service Worker registration found");
      return null;
    }

    // Check for existing subscription
    let subscription = await swReg.pushManager.getSubscription();

    if (!subscription) {
      // Create new subscription
      subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log("[Push] New push subscription created");
    } else {
      console.log("[Push] Existing push subscription found");
    }

    try { localStorage.setItem(STORAGE_KEY_SUBSCRIPTION, "true"); } catch { /* ignore */ }

    return subscription.toJSON();
  } catch (e) {
    console.error("[Push] Failed to subscribe:", e);
    return null;
  }
}

/**
 * Unsubscribe from server-side push notifications.
 * Returns the endpoint that was unsubscribed, or null.
 */
export async function unsubscribeFromPush(): Promise<string | null> {
  try {
    const swReg = await getServiceWorkerRegistration();
    if (!swReg) return null;

    const subscription = await swReg.pushManager.getSubscription();
    if (!subscription) return null;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    try {
      localStorage.removeItem(STORAGE_KEY_SUBSCRIPTION);
      localStorage.removeItem(STORAGE_KEY_PUSH);
    } catch { /* ignore */ }

    return endpoint;
  } catch (e) {
    console.error("[Push] Failed to unsubscribe:", e);
    return null;
  }
}

/**
 * Send a local notification (fallback when server push is not available).
 * Uses SW.showNotification() or new Notification().
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  options?: {
    icon?: string;
    badge?: string;
    tag?: string;
    requireInteraction?: boolean;
  }
): Promise<boolean> {
  if (!isNotificationPermitted()) return false;

  const notifOptions = {
    body,
    icon: options?.icon ?? "/logo-abrwf.png",
    badge: options?.badge ?? "/logo-abrwf.png",
    tag: options?.tag ?? "salon-ready",
    requireInteraction: options?.requireInteraction ?? true,
    silent: false,
    vibrate: [200, 100, 200, 100, 200],
  };

  // Try Service Worker first
  try {
    const swReg = await getServiceWorkerRegistration();
    if (swReg) {
      await swReg.showNotification(title, notifOptions as any);
      return true;
    }
  } catch (e) {
    console.warn("[Push] SW showNotification failed, falling back:", e);
  }

  // Fallback: direct Notification API
  try {
    const notification = new Notification(title, notifOptions);
    if (!options?.requireInteraction) {
      setTimeout(() => notification.close(), 8000);
    }
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch (e) {
    console.warn("[Push] Failed to send notification:", e);
    return false;
  }
}

/**
 * Web Push Notification utility for the salon module.
 * Sends native browser notifications even when the tab is in background or screen is locked.
 *
 * Usage:
 * 1. Call `requestNotificationPermission()` once on user gesture
 * 2. Call `sendPushNotification(title, body)` when items are ready
 *
 * iOS Safari PWA (Add to Home Screen) support:
 * - iOS 16.4+ supports Web Notifications when the app is added to the Home Screen
 * - Requires Service Worker registration (sw.js) and manifest.json
 * - Uses SW.showNotification() for reliable delivery, falls back to new Notification()
 *
 * Persistence: uses localStorage key "salon_push_granted" to remember state across page navigations.
 */

const STORAGE_KEY = "salon_push_granted";

/**
 * Check if the browser supports the Notification API.
 */
export function isNotificationSupported(): boolean {
  return "Notification" in window;
}

/**
 * Check if Service Worker is registered and available.
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
 * Used to restore UI state on page navigation without re-requesting permission.
 */
export function getPushGrantedFromStorage(): boolean {
  try {
    if (!isNotificationSupported()) return false;
    // Also verify the actual browser permission hasn't been revoked
    if (Notification.permission !== "granted") {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Request permission to send browser notifications.
 * Must be called from a user gesture (button click).
 * Returns 'granted', 'denied', or 'default'.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    console.warn("[Push] Notifications not supported in this browser");
    return "denied";
  }

  if (Notification.permission === "granted") {
    try { localStorage.setItem(STORAGE_KEY, "true"); } catch { /* ignore */ }
    return "granted";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  try {
    const result = await Notification.requestPermission();
    if (result === "granted") {
      try { localStorage.setItem(STORAGE_KEY, "true"); } catch { /* ignore */ }
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
 * Send a native browser notification.
 * Prefers Service Worker showNotification() for better iOS PWA support.
 * Falls back to new Notification() for desktop browsers.
 * Returns true if notification was sent, false otherwise.
 */
export async function sendPushNotification(
  title: string,
  body: string,
  options?: {
    icon?: string;
    badge?: string;
    tag?: string; // same tag replaces previous notification
    requireInteraction?: boolean; // keep notification until user interacts
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
  };

  // Try Service Worker first (better iOS PWA support, works with screen locked)
  try {
    const swReg = await getServiceWorkerRegistration();
    if (swReg) {
      await swReg.showNotification(title, notifOptions);
      return true;
    }
  } catch (e) {
    console.warn("[Push] SW showNotification failed, falling back:", e);
  }

  // Fallback: direct Notification API
  try {
    const notification = new Notification(title, notifOptions);

    // Auto-close after 8 seconds if not requireInteraction
    if (!options?.requireInteraction) {
      setTimeout(() => notification.close(), 8000);
    }

    // Click notification to focus the app
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

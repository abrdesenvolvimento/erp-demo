/**
 * Web Push Notification utility for the salon module.
 * Sends native browser notifications even when the tab is in background or screen is locked.
 *
 * Usage:
 * 1. Call `requestNotificationPermission()` once on user gesture
 * 2. Call `sendPushNotification(title, body)` when items are ready
 *
 * Note: iOS Safari 16.4+ supports Web Push Notifications when the app is added to Home Screen.
 * For regular Safari browsing on iOS, notifications may not work.
 */

/**
 * Request permission to send browser notifications.
 * Must be called from a user gesture (button click).
 * Returns 'granted', 'denied', or 'default'.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    console.warn("[Push] Notifications not supported in this browser");
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return "denied";
  }
}

/**
 * Check if notifications are currently permitted.
 */
export function isNotificationPermitted(): boolean {
  return "Notification" in window && Notification.permission === "granted";
}

/**
 * Send a native browser notification.
 * Works even when the tab is in background.
 * On iOS (added to Home Screen), works when screen is locked.
 */
export function sendPushNotification(
  title: string,
  body: string,
  options?: {
    icon?: string;
    badge?: string;
    tag?: string; // same tag replaces previous notification
    requireInteraction?: boolean; // keep notification until user interacts
  }
): void {
  if (!isNotificationPermitted()) return;

  try {
    const notification = new Notification(title, {
      body,
      icon: options?.icon ?? "/favicon.ico",
      badge: options?.badge,
      tag: options?.tag ?? "salon-ready",
      requireInteraction: options?.requireInteraction ?? false,
      silent: false, // allow system sound
    });

    // Auto-close after 8 seconds if not requireInteraction
    if (!options?.requireInteraction) {
      setTimeout(() => notification.close(), 8000);
    }

    // Click notification to focus the app
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (e) {
    console.warn("[Push] Failed to send notification:", e);
  }
}

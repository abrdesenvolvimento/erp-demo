/** Compatibility tombstone for previously installed OAuth retry workers.
 * OAuth codes/nonces are one-use; callbacks must NEVER be replayed.
 * The application now registers only /sw.js for notifications.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => {
  event.waitUntil(self.registration.unregister());
});

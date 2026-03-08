import webpush from "web-push";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import { pushSubscriptions } from "../drizzle/schema";

// Configure VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = "mailto:contato@abrwf.com.br";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log("[WebPush] VAPID keys configured successfully");
} else {
  console.warn("[WebPush] VAPID keys not set — push notifications disabled");
}

// Save a push subscription to the database
export async function savePushSubscription(
  userId: string,
  companyId: number,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Remove existing subscription for this endpoint (avoid duplicates)
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

  // Insert new subscription
  await db.insert(pushSubscriptions).values({
    userId,
    companyId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  });

  return { success: true };
}

// Remove a push subscription
export async function removePushSubscription(endpoint: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));

  return { success: true };
}

// Send push notification to all subscribers of a company
export async function sendPushToCompany(
  companyId: number,
  payload: { title: string; body: string; icon?: string; data?: Record<string, unknown> }
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[WebPush] Cannot send push: VAPID keys not configured");
    return { sent: 0, failed: 0 };
  }

  const db = await getDb();
  if (!db) {
    console.warn("[WebPush] Cannot send push: DB unavailable");
    return { sent: 0, failed: 0 };
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.companyId, companyId));

  if (subs.length === 0) {
    console.log(`[WebPush] No subscribers for company ${companyId}`);
    return { sent: 0, failed: 0 };
  }

  const payloadStr = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payloadStr,
          { TTL: 60 } // 60 seconds TTL
        );
        sent++;
      } catch (error: any) {
        failed++;
        // If subscription is expired or invalid, remove it
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`[WebPush] Removing expired subscription: ${sub.endpoint.slice(0, 50)}...`);
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
        } else {
          console.error(`[WebPush] Failed to send to ${sub.endpoint.slice(0, 50)}...`, error.statusCode || error.message);
        }
      }
    })
  );

  console.log(`[WebPush] Company ${companyId}: sent=${sent}, failed=${failed}, total=${subs.length}`);
  return { sent, failed };
}

import crypto from "node:crypto";
import webpush from "web-push";

// Configure VAPID details for Web Push
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = "mailto:support@coachziri.com";

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.error("Failed to set VAPID details:", err);
  }
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  data?: {
    taskId?: string;
    url?: string;
    [key: string]: any;
  };
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send a Web Push notification to a single subscription.
 * Returns true if successful, false if expired (410 Gone / 404).
 */
export async function sendWebPush(
  subscription: PushSubscriptionRow,
  payload: PushPayload
): Promise<{ success: boolean; statusCode?: number; shouldRemove?: boolean }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID keys not configured. Skipping Web Push.");
    return { success: false };
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    const res = await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
      {
        TTL: 60 * 60, // 1 hour TTL
        urgency: "high",
      }
    );
    return { success: true, statusCode: res.statusCode };
  } catch (err: any) {
    console.error("Web Push send error:", err?.statusCode, err?.message);
    // HTTP 404 Not Found or 410 Gone means the subscription is no longer valid
    const isExpired = err?.statusCode === 404 || err?.statusCode === 410;
    return { success: false, statusCode: err?.statusCode, shouldRemove: isExpired };
  }
}

function getReminderSigningSecret(): string {
  return (
    process.env.PUSH_CRON_SECRET ||
    process.env.VAPID_PRIVATE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

/** Signs a taskId so background service-worker reminder actions cannot be forged. */
export function signReminderActionToken(taskId: string): string {
  const secret = getReminderSigningSecret();
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(taskId).digest("hex");
}

/** Verifies a reminder action HMAC token in constant time. */
export function verifyReminderActionToken(taskId: string, token: string): boolean {
  const secret = getReminderSigningSecret();
  if (!secret || !token) return false;
  const expected = crypto.createHmac("sha256", secret).update(taskId).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

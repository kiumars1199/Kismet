// F10 web push sender. Server only: imported by lib/alerts-server.ts (the cron), never by a client component, so the
// `web-push` package stays out of every browser bundle. VAPID keys are server secrets Q sets in Vercel; nothing here
// generates or stores one. With any of them unset, pushConfigured() is false and the evaluator skips push entirely.
//   VAPID_PUBLIC_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY  the same public key (the second is what the browser reads)
//   VAPID_PRIVATE_KEY                                 secret
//   VAPID_SUBJECT                                     "mailto:you@example.com" or the site URL
import webpush from "web-push";

export interface PushSub { endpoint: string; keys: { p256dh: string; auth: string } }
export interface PushPayload { title: string; body: string; url: string }
export type PushResult = "sent" | "gone" | "failed";

const vapid = () => ({
  publicKey: process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  privateKey: process.env.VAPID_PRIVATE_KEY || "",
  subject: process.env.VAPID_SUBJECT || "",
});

export const pushConfigured = (): boolean => {
  const v = vapid();
  return !!(v.publicKey && v.privateKey && v.subject);
};

/** One push to one device. "gone" = the push service says the subscription no longer exists (404/410): delete it. */
export async function sendPush(sub: PushSub, payload: PushPayload): Promise<PushResult> {
  if (!pushConfigured()) return "failed";
  const v = vapid();
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), {
      vapidDetails: { subject: v.subject, publicKey: v.publicKey, privateKey: v.privateKey },
      TTL: 6 * 3600,   // an alert older than the next daily check is stale
      timeout: 8_000,
    });
    return "sent";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return code === 404 || code === 410 ? "gone" : "failed";
  }
}

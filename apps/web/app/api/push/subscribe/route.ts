// F10: POST { endpoint, keys: { p256dh, auth } } saves this device for web push; DELETE { endpoint } turns it off.
// Signed in, same origin, Pro or Premium (lib/alerts-push-store.ts). Stored in push_subscriptions under RLS.
import { pushConfigured } from "@/lib/alerts-push";
import { removeSubscription, saveSubscription } from "@/lib/alerts-push-store";
import { adminEnabled, getMe, supabaseAdmin } from "@/lib/auth/server";
import { TOO_LARGE, tooLarge } from "@/lib/body";
import { readBody, withUser } from "@/lib/repo/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The public VAPID key the browser subscribes with (not a secret). null until Q sets the server keys.
export const GET = (req: Request) =>
  withUser(req, async () => Response.json({
    publicKey: pushConfigured() ? (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null) : null,
  }));

export const POST = (req: Request) =>
  withUser(req, async ({ db, userId }) => {
    const raw = await readBody(req);
    if (raw === TOO_LARGE) return tooLarge();
    return saveSubscription(db, userId, (await getMe()).tier, raw, adminEnabled() ? supabaseAdmin() : null);
  });

export const DELETE = (req: Request) =>
  withUser(req, async ({ db, userId }) => {
    const raw = await readBody(req);
    if (raw === TOO_LARGE) return tooLarge();
    return removeSubscription(db, userId, raw);
  });

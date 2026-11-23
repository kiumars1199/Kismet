// F10: save and remove a device's push subscription (POST/DELETE /api/push/subscribe). Runs as the signed-in user, so
// the RLS policy on push_subscriptions (own rows only) is the second lock. Server only.
import "@/lib/zod-jitless";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { can, type Tier } from "@/lib/entitlements";

export const MAX_DEVICES = 10;

// The cron POSTs to this URL, so it must be a browser vendor's push service, never an arbitrary host (SSRF).
const PUSH_HOSTS = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];
export function isPushEndpoint(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password && !u.port &&
      PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

const endpoint = z.string().max(1000).refine(isPushEndpoint);
const Save = z.object({ endpoint, keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }).strict() }).strict();
const Remove = z.object({ endpoint }).strict();

const err = (status: number, error: string) => Response.json({ error }, { status });

export async function saveSubscription(db: SupabaseClient, userId: string, tier: Tier, raw: unknown): Promise<Response> {
  if (!can(tier, "push")) return err(403, "Push alerts are on Pro and Premium.");
  const body = Save.safeParse(raw);
  if (!body.success) return err(400, "That isn't a push subscription.");
  const mine = await db.from("push_subscriptions").select("endpoint").eq("user_id", userId);
  if (mine.error) return err(500, "Couldn't save this device.");
  const rows = (mine.data ?? []) as { endpoint: string }[];
  if (rows.length >= MAX_DEVICES && !rows.some((r) => r.endpoint === body.data.endpoint))
    return err(409, `You can turn on alerts for up to ${MAX_DEVICES} devices. Turn one off first.`);
  const { error } = await db.from("push_subscriptions")
    .upsert({ user_id: userId, endpoint: body.data.endpoint, keys: body.data.keys }, { onConflict: "endpoint" });
  return error ? err(500, "Couldn't save this device.") : Response.json({ ok: true });
}

export async function removeSubscription(db: SupabaseClient, userId: string, raw: unknown): Promise<Response> {
  const body = Remove.safeParse(raw);
  if (!body.success) return err(400, "That isn't a push subscription.");
  const { error } = await db.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", body.data.endpoint);
  return error ? err(500, "Couldn't turn this device off.") : Response.json({ ok: true });
}

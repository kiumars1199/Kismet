// POST /api/admin — every admin mutation (T-141). Order: requireAdmin (404 for anyone else, so the route's
// existence isn't revealed) → same-origin (CSRF) → rate limit → strict zod → act with the service role →
// append to admin_audit_log. Destructive actions need the target's email typed back; never on your own account.
import { z } from "zod";
import { rateLimit } from "@/lib/abuse";
import { audit, requireAdmin, type AdminCtx } from "@/lib/admin/server";
import { deleteAccount } from "@/lib/auth/delete";
import { sameOrigin } from "@/lib/auth/server";
import { sendEmail, siteUrl, unsubscribeUrl } from "@/lib/email";
import { signInEmail } from "@/lib/email/templates";
import { readBody } from "@/lib/repo/server";
import { bustSettings, getSettings } from "@/lib/settings";
import { SETTINGS, type SettingKey } from "@/lib/settings-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uid = z.uuid();
const confirm = z.string().max(254);
const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("comp"), user_id: uid, tier: z.enum(["pro", "premium"]),
    expires_at: z.iso.datetime({ offset: true }).nullable().refine((d) => d === null || Date.parse(d) > Date.now(), "Expiry must be in the future"),
  }).strict(),
  z.object({ action: z.literal("uncomp"), user_id: uid }).strict(),
  z.object({ action: z.literal("revoke_sessions"), user_id: uid, confirm }).strict(),
  z.object({ action: z.literal("delete_user"), user_id: uid, confirm }).strict(),
  z.object({ action: z.literal("send_link"), user_id: uid }).strict(),
  z.object({ action: z.literal("settings"), patch: SETTINGS.partial() }).strict(),
]);
type Body = z.infer<typeof Body>;

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request): Promise<Response> {
  const ctx = await requireAdmin();
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const limited = await rateLimit("admin", `u:${ctx.admin.id}`);
  if (limited) return limited;
  const parsed = Body.safeParse(await readBody(req).catch(() => null));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");
  try {
    return await act(ctx, parsed.data);
  } catch (e) {
    console.error("[admin]", parsed.data.action, (e as Error).message);
    return fail(500, "That didn't work. Check the audit log before retrying.");
  }
}

async function target(ctx: AdminCtx, id: string) {
  const { data } = await ctx.db.auth.admin.getUserById(id);
  return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
}

async function act(ctx: AdminCtx, b: Body): Promise<Response> {
  const { db, admin } = ctx;
  if (b.action === "settings") {
    const keys = Object.keys(b.patch) as SettingKey[];
    if (!keys.length) return fail(400, "Nothing to change");
    const now = await getSettings();
    const { error } = await db.from("app_settings").upsert(
      keys.map((key) => ({ key, value: b.patch[key], updated_at: new Date().toISOString(), updated_by: admin.id })),
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    bustSettings();
    await audit(ctx, "settings.update", keys.join(","), Object.fromEntries(keys.map((k) => [k, now[k]])), b.patch);
    return Response.json({ ok: true, settings: await getSettings() });
  }

  const user = await target(ctx, b.user_id);
  if (!user) return fail(404, "No such user");
  const self = user.id === admin.id;
  const typed = "confirm" in b && b.confirm.trim().toLowerCase() === user.email.toLowerCase();

  switch (b.action) {
    case "comp":
    case "uncomp": {
      const { data: before } = await db.from("subscriptions").select("comp_tier, comp_expires_at").eq("user_id", user.id).maybeSingle();
      const after = b.action === "comp" ? { comp_tier: b.tier, comp_expires_at: b.expires_at } : { comp_tier: null, comp_expires_at: null };
      const { error } = await db.from("subscriptions").upsert({ user_id: user.id, ...after }, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
      await audit(ctx, `user.${b.action}`, user.email, before ?? null, after);
      return Response.json({ ok: true });
    }
    case "revoke_sessions": {
      if (self) return fail(400, "Use Sign out everywhere on your own account page instead.");
      if (!typed) return fail(400, "Type the user's email exactly to confirm.");
      const { data: n, error } = await db.rpc("admin_revoke_sessions", { uid: user.id });
      if (error) throw new Error(error.message);
      await audit(ctx, "user.revoke_sessions", user.email, null, { sessions_revoked: n ?? 0 });
      return Response.json({ ok: true, revoked: n ?? 0 });
    }
    case "delete_user": {
      if (self) return fail(400, "You can't delete your own account from the admin panel.");
      if (!typed) return fail(400, "Type the user's email exactly to confirm.");
      const { data: before } = await db.from("subscriptions").select("tier, status, stripe_customer_id, comp_tier").eq("user_id", user.id).maybeSingle();
      const r = await deleteAccount(user.id, false);   // cancels Stripe first, then deletes (rows cascade)
      if (!r.ok) return fail(r.status, r.error);
      await audit(ctx, "user.delete", user.email, { id: user.id, ...(before ?? {}) }, null);
      return Response.json({ ok: true });
    }
    case "send_link": {
      // The link goes only to the user's inbox; it is never returned to the admin's browser.
      const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email: user.email });
      const hash = data?.properties?.hashed_token;
      if (error || !hash) throw new Error(error?.message ?? "no token");
      const link = `${siteUrl()}/auth/callback?token_hash=${encodeURIComponent(hash)}&type=magiclink`;
      const sent = await sendEmail(signInEmail(user.email, link, unsubscribeUrl(user.id)));
      if (!sent.sent) return fail(503, "Email isn't set up (RESEND_API_KEY and EMAIL_FROM). Nothing was sent.");
      await audit(ctx, "user.send_link", user.email, null, { sent: true });
      return Response.json({ ok: true });
    }
  }
}

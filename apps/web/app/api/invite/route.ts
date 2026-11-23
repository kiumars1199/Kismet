// GET /api/invite: the signed-in user's invite link and the live "n of 5" counter (F13). Reads and the one-time code
// creation use the service role (the tables have no client write policy); the user is checked first.
import { adminEnabled, supabaseAdmin } from "@/lib/auth/server";
import { siteUrl } from "@/lib/site";
import { withUser } from "@/lib/repo/server";
import { inviteUrl } from "@/lib/invites/core";
import { getOrCreateCode, inviteProgress, recordInviterIp } from "@/lib/invites/server";
import { hashedIp } from "@/lib/invites/signin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: Request) =>
  withUser(req, async ({ userId }) => {
    if (!adminEnabled()) return Response.json({ error: "Invites are unavailable" }, { status: 503 });
    const db = supabaseAdmin();
    const code = await getOrCreateCode(db, userId);
    await recordInviterIp(db, userId, await hashedIp());   // this device is the owner's own: its sign-ups never count
    const progress = await inviteProgress(db, userId);
    return Response.json({ code, url: inviteUrl(siteUrl(), code), ...progress }, { headers: { "Cache-Control": "no-store" } });
  });

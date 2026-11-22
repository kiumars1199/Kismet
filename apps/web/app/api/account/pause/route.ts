// F8 self-pause: POST { length: "24h" | "7d" | "30d" } sets profiles.paused_until with the service role (the column is
// server-owned: a user's own JWT can't write it). An active pause is never shortened. Signed in + same origin.
import "@/lib/zod-jitless";
import { z } from "zod";
import { PAUSE_KEYS, pauseEnd } from "@/lib/account/pause";
import { getMe, supabaseAdmin } from "@/lib/auth/server";
import { readBody, withUser } from "@/lib/repo/server";
import { TOO_LARGE, tooLarge } from "@/lib/body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ length: z.enum(PAUSE_KEYS) }).strict();

export const POST = (req: Request) =>
  withUser(req, async ({ userId }) => {
    const raw = await readBody(req);
    if (raw === TOO_LARGE) return tooLarge();
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return Response.json({ error: "Pick 24 hours, 7 days or 30 days." }, { status: 400 });
    const me = await getMe();
    const until = pauseEnd(parsed.data.length, Date.now(), me.paused_until);
    const { error } = await supabaseAdmin().from("profiles").update({ paused_until: until }).eq("user_id", userId);
    if (error) {
      console.error("[pause] write failed", error.message);
      return Response.json({ error: "Couldn't start the pause. Try again." }, { status: 500 });
    }
    return Response.json({ paused_until: until }, { headers: { "Cache-Control": "private, no-store" } });
  });

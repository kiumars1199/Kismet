// /api/digest/optin: the signed-in user's morning-digest opt-in (F12). Default off. GET = current state, POST {on} sets it.
// Written with the service role after the session is checked (profiles.digest_opt_in is not a client column).
import { adminEnabled, supabaseAdmin } from "@/lib/auth/server";
import { withUser } from "@/lib/repo/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: Request) =>
  withUser(req, async ({ userId }) => {
    if (!adminEnabled()) return Response.json({ on: false });
    const { data } = await supabaseAdmin().from("profiles").select("digest_opt_in").eq("user_id", userId).maybeSingle();
    return Response.json({ on: data?.digest_opt_in === true }, { headers: { "Cache-Control": "no-store" } });
  });

export const POST = (req: Request) =>
  withUser(req, async ({ userId }) => {
    if (!adminEnabled()) return Response.json({ error: "Unavailable" }, { status: 503 });
    const body = (await req.json().catch(() => null)) as { on?: unknown } | null;
    if (typeof body?.on !== "boolean") return Response.json({ error: "on must be true or false" }, { status: 400 });
    const { error } = await supabaseAdmin().from("profiles").update({ digest_opt_in: body.on }).eq("user_id", userId);
    if (error) return Response.json({ error: "Couldn't save" }, { status: 500 });
    return Response.json({ on: body.on });
  });

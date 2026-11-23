// GET /api/share/link?m=<market id>: the signed link a signed-in person shares for one bet (F13). The server picks the
// side (always the recommended one) and signs (id, side) only when the bet is flagged (that side has a positive edge), so
// the public share image shows numbers only for links made here, for flagged bets. Any other bet shares the teaser. The link also carries the sharer's invite code.
import { adminEnabled, supabaseAdmin } from "@/lib/auth/server";
import { rateLimit } from "@/lib/abuse";
import { getStoreFor } from "@/lib/data/store";
import { withUser } from "@/lib/repo/server";
import { getOrCreateCode } from "@/lib/invites/server";
import { shareSig } from "@/lib/share/sig";
import { isShareable } from "@/lib/share/card-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: Request) =>
  withUser(req, async ({ userId }) => {
    const refused = await rateLimit("markets", `share:${userId}`);
    if (refused) return refused;
    const id = new URL(req.url).searchParams.get("m") ?? "";
    const store = await getStoreFor("free");
    const m = store.flagsById.get(id) ?? store.byId.get(id);
    if (!m) return Response.json({ error: "Not found" }, { status: 404 });
    const side = m.best.side_index;
    const sig = isShareable(store, m.id, side) ? shareSig(m.id, side) : null;   // only flagged bets get numbers; others share the teaser
    let ref = "";
    try { if (adminEnabled()) ref = `ref=${await getOrCreateCode(supabaseAdmin(), userId)}&`; } catch { /* invites unavailable: the link still works */ }
    const enc = encodeURIComponent(m.id);
    const tail = sig ? `s=${side}&sig=${sig}` : "";
    return Response.json(
      { path: `/m/${enc}?${ref}${tail}`.replace(/[?&]$/, ""), image: `/api/og/bet/${enc}${sig ? `?${tail}` : ""}` },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });

// F9: POST { state: "TX" | null } remembers the visitor's US state in a cookie so every bet button can say whether the
// venue is available there. Same origin only; validated against the 50 states + DC; nothing is stored server-side.
import "@/lib/zod-jitless";
import { NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_OPTIONS, sameOrigin } from "@/lib/auth/server";
import { STATE_COOKIE, US_STATES, validState } from "@/lib/venues/states";
import { statusesFor } from "@/lib/venues/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: the visitor's state and the three statuses, read from the httpOnly cookie. Static pages ("/" is force-static) have
 *  no cookies at render time, so the client asks here once (AvailabilityProvider). Never cached. */
export async function GET(req: Request) {
  const raw = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${STATE_COOKIE}=`))?.slice(STATE_COOKIE.length + 1);
  const state = validState(raw);
  return Response.json(
    { state, stateName: state ? US_STATES[state]! : null, statuses: statusesFor(state) },
    { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
  );
}

const Body = z.object({ state: z.string().max(2).nullable() }).strict();

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a state" }, { status: 400 });
  const res = new NextResponse(null, { status: 204 });
  if (parsed.data.state === null || parsed.data.state === "") {
    res.cookies.set(STATE_COOKIE, "", { maxAge: 0, ...COOKIE_OPTIONS });
    return res;
  }
  const state = validState(parsed.data.state);
  if (!state) return Response.json({ error: "Unknown state" }, { status: 400 });
  res.cookies.set(STATE_COOKIE, state, { maxAge: 31_536_000, ...COOKIE_OPTIONS });
  return res;
}

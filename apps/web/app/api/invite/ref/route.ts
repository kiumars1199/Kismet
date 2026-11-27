// F13: a shared bet link (/m/<id>?ref=<code>) carries the sharer's invite code. The page posts it here and the code is
// remembered for 30 days exactly like /invite/<code> does (HttpOnly cookie, read once at first sign-in). Public: the
// visitor is signed out. A bad code is ignored. Never an error the visitor sees.
import { NextResponse } from "next/server";
import { COOKIE_OPTIONS, sameOrigin } from "@/lib/auth/server";
import { isInviteCode } from "@/lib/invites/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 204 });
  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const res = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  if (typeof body?.code === "string" && isInviteCode(body.code)) res.cookies.set("me_invite", body.code, { ...COOKIE_OPTIONS, maxAge: 30 * 86_400 });
  return res;
}

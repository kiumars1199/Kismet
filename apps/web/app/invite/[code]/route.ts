// F13: an invite link. Remembers the code for 30 days in an HttpOnly cookie and sends the visitor to sign up. A bad
// code is ignored (plain /signup). The cookie is read once, at first sign-in (lib/invites/signin.ts).
import { NextResponse } from "next/server";
import { COOKIE_OPTIONS } from "@/lib/auth/server";
import { isInviteCode } from "@/lib/invites/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const res = NextResponse.redirect(new URL("/signup", req.url), 307);
  if (isInviteCode(code)) {
    res.cookies.set("me_invite", code, { ...COOKIE_OPTIONS, maxAge: 30 * 86_400 });
  }
  res.headers.set("Cache-Control", "no-store");
  return res;
}

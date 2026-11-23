// T-89c: the combo checker tells the server how many legs this browser keeps (a count, nothing else), so the next /check/combo
// load can reserve the legs list's height in its first HTML instead of growing after hydration. HttpOnly session cookie, same
// options as every cookie we set (browser code sets none: test/security.test.ts). Public like /api/check; a bad body is ignored.
import { NextResponse } from "next/server";
import { COOKIE_OPTIONS, sameOrigin } from "@/lib/auth/server";
import { COUNT_COOKIE } from "@/lib/check/comboLegs";
import { MAX_COMBO_LEGS } from "@/lib/check/combo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 204 });
  const body = (await req.json().catch(() => null)) as { n?: unknown } | null;
  const res = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  if (typeof body?.n === "number" && Number.isInteger(body.n) && body.n >= 0 && body.n <= MAX_COMBO_LEGS) res.cookies.set(COUNT_COOKIE, String(body.n), { ...COOKIE_OPTIONS, path: "/check" });
  return res;
}

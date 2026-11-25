// POST /api/bets/height { h } (T-wt3l): remembers how tall the /bets page was when the user left it, in a server-set cookie, so the loading
// skeleton on the way back (app/bets/loading.tsx, rendered on the server) can reserve that height. One number; it changes only the height of a
// placeholder, never what the page shows. The browser sets no cookies itself (test/security.test.ts), hence this route.
import { cookies } from "next/headers";
import { z } from "zod";
import { COOKIE_OPTIONS, sameOrigin } from "@/lib/auth/server";
import { readJson, TOO_LARGE, tooLarge } from "@/lib/body";
import { REMEMBER_COOKIE } from "@/app/bets/remember";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ h: z.number().int().min(1).max(500_000) }).strict();

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const raw = await readJson(req, 256);
  if (raw === TOO_LARGE) return tooLarge();
  const body = Body.safeParse(raw);
  if (!body.success) return Response.json({ error: "body must be { h: number }" }, { status: 400 });
  (await cookies()).set(REMEMBER_COOKIE, String(body.data.h), { ...COOKIE_OPTIONS, maxAge: 60 * 60 });
  return new Response(null, { status: 204 });
}

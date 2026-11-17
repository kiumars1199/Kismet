// POST /api/ext/token/refresh (Authorization: Bearer <token>) → a fresh token while the old one is still valid.
// ponytail: tier is carried over; once accounts exist (Lane L) re-read the tier and revoked sessions here.
import { issueExtToken, verifyExtToken } from "@/lib/trade/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const old = verifyExtToken(req.headers.get("authorization")?.replace(/^Bearer /, ""));
  if (!old) return Response.json({ error: "Expired. Sign in again." }, { status: 401 });
  const t = issueExtToken(old.sub, old.tier);
  if (!t) return Response.json({ error: "Not configured." }, { status: 503 });
  return Response.json(t, { headers: { "cache-control": "no-store" } });
}

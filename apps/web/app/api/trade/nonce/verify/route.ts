// POST /api/trade/nonce/verify {nonce, action, payload} → {ok}. Called by the extension right before it signs.
// Consumes the nonce: true once, only for the exact order it was issued for, within 2 minutes.
import { NonceRequest } from "@/lib/trade/intent";
import { consumeNonce, tradingEnv } from "@/lib/trade/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (!tradingEnv()) return Response.json({ ok: false }, { status: 404 });
  const raw = (await req.json().catch(() => null)) as { nonce?: unknown } | null;
  const body = NonceRequest.safeParse(raw);
  if (!body.success || typeof raw?.nonce !== "string" || raw.nonce.length > 1024) return Response.json({ ok: false }, { status: 400 });
  const ok = consumeNonce(raw.nonce, body.data.action, body.data.payload);
  return Response.json({ ok }, { status: ok ? 200 : 403, headers: { "cache-control": "no-store" } });
}

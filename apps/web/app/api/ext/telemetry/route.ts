// POST /api/ext/telemetry {kind:"no_rows", slug, markets} → 204. Selector-breakage signal from the extension (docs/09, T-54).
// Carries no user data: the event slug (public) and a count. Logged so a Polymarket markup change shows up fast.
import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/abuse";

export const dynamic = "force-dynamic";

const Body = z.object({ kind: z.literal("no_rows"), slug: z.string().regex(/^[\w-]{1,200}$/), markets: z.number().int().min(0).max(10_000) }).strict();

export async function POST(req: Request): Promise<Response> {
  const limited = await rateLimit("book", clientKey(req));   // unauthenticated log line: 30 a minute per IP
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return new Response(null, { status: 400 });
  console.info("[ext-telemetry]", b.data.kind, b.data.slug, b.data.markets);
  return new Response(null, { status: 204 });
}

// Email magic link (docs/08). The 18+/Terms box must be ticked; the callback stores accepted_terms_at.
import { z } from "zod";
import { guard, rateLimit } from "@/lib/abuse";
import { authEnabled, safeNext, sameOrigin, supabaseServer } from "@/lib/auth/server";
import { rememberTerms } from "@/lib/auth/terms";
import { readJson, TOO_LARGE, tooLarge } from "@/lib/body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.email().max(254), accept: z.literal(true), next: z.string().max(512).optional() }).strict();

export async function POST(req: Request) {
  if (!authEnabled()) return Response.json({ error: "Accounts are not set up yet" }, { status: 503 });
  if (!sameOrigin(req)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const refused = await guard(req, "auth_ip");   // BotID + 5/min per IP
  if (refused) return refused;
  const raw = await readJson(req, 4_096);   // RT-12: bounded
  if (raw === TOO_LARGE) return tooLarge();
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Enter a valid email and tick the box" }, { status: 400 });
  const { email, next } = parsed.data;
  const perEmail = await rateLimit("auth_email", `email:${email.trim().toLowerCase()}`);   // 5/hour per address
  if (perEmail) return perEmail;
  const origin = new URL(req.url).origin;
  const { error } = await (await supabaseServer()).auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}` },
  });
  if (error) {
    const limited = error.status === 429;
    return Response.json({ error: limited ? "Too many tries. Wait a minute and try again." : "Couldn't send the link. Try again." }, { status: limited ? 429 : 400 });
  }
  await rememberTerms();
  return Response.json({ ok: true });
}

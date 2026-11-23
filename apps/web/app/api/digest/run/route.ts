// /api/digest/run: the morning digest (F12), Vercel Cron (apps/web/vercel.json). GET only, needs the cron secret.
// Emails opted-in users (profiles.digest_opt_in), skipping paused accounts. Pro/Premium get the live top bets in their chosen
// topics; Free gets its own daily Free sample (the delayed Free store), nothing a Free user could not see on /bets. Sends through the existing mail abstraction (lib/email sendEmail); no Resend key = nothing is sent.
import { adminEnabled, supabaseAdmin } from "@/lib/auth/server";
import { DEMO_MODE } from "@/lib/config";
import { cronAuthorized, unauthorized } from "@/lib/cron";
import { getStore, getStoreFor } from "@/lib/data/store";
import { effectiveTier } from "@/lib/entitlements";
import { digestBets } from "@/lib/email/digest-bets";
import { defaultSend, defaultUnsubscribe, runDigest, supabaseDigestClaims, type DigestUser } from "@/lib/email/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: Request): Promise<Response> {
  if (!cronAuthorized(req)) return unauthorized();
  if (DEMO_MODE) return Response.json({ ran: false, reason: "demo mode has no accounts" });
  if (!adminEnabled()) return Response.json({ ran: false, reason: "Supabase service role not configured" });
  const db = supabaseAdmin();
  try {
    const live = await getStore();
    const free = getStoreFor("free").catch(() => null);   // Free's delayed copy may not exist yet: its users get no email this run
    const result = await runDigest({
      users: async () => {
        const { data, error } = await db.from("profiles").select("user_id, favorite_topics, paused_until").eq("digest_opt_in", true);
        if (error) throw new Error(error.message);
        const out: DigestUser[] = [];
        for (const p of (data ?? []) as { user_id: string; favorite_topics: string[] | null; paused_until?: string | null }[]) {
          const email = (await db.auth.admin.getUserById(p.user_id)).data.user?.email;
          if (!email) continue;
          const sub = await db.from("subscriptions").select("*").eq("user_id", p.user_id).maybeSingle();
          out.push({ user_id: p.user_id, email, topics: p.favorite_topics ?? [], tier: effectiveTier(sub.error ? null : sub.data), paused_until: p.paused_until ?? null });
        }
        return out;
      },
      betsFor: async (topics, u) => {
        const freeStore = await free;
        if (u.tier === "free" && !freeStore) return [];
        return digestBets({ live, free: freeStore ?? live }, u.tier, u.user_id, topics);
      },
      ...supabaseDigestClaims(db),
      send: defaultSend,
      unsubscribe: defaultUnsubscribe,
    });
    return Response.json({ ran: true, ...result });
  } catch (e) {
    console.error("[digest/run]", (e as Error).message);
    return Response.json({ ran: false, error: "digest run failed" }, { status: 500 });
  }
}

export const GET = run;

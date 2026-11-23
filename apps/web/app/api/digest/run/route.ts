// /api/digest/run: the morning digest (F12), Vercel Cron (apps/web/vercel.json). GET only, needs the cron secret.
// Emails opted-in users (profiles.digest_opt_in) the top bets in their chosen topics; same bets for everyone with
// the same topics. Sends through the existing mail abstraction (lib/email sendEmail); no Resend key = nothing is sent.
import { adminEnabled, supabaseAdmin } from "@/lib/auth/server";
import { DEMO_MODE } from "@/lib/config";
import { cronAuthorized, unauthorized } from "@/lib/cron";
import { marketsPage } from "@/lib/data/respond";
import { getStore } from "@/lib/data/store";
import { FilterState } from "@/lib/filters/state";
import { defaultSend, defaultUnsubscribe, runDigest, supabaseDigestClaims, type DigestUser } from "@/lib/email/digest";
import { MAX_DIGEST_BETS } from "@/lib/email/digest-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: Request): Promise<Response> {
  if (!cronAuthorized(req)) return unauthorized();
  if (DEMO_MODE) return Response.json({ ran: false, reason: "demo mode has no accounts" });
  if (!adminEnabled()) return Response.json({ ran: false, reason: "Supabase service role not configured" });
  const db = supabaseAdmin();
  try {
    const store = await getStore();
    const result = await runDigest({
      users: async () => {
        const { data, error } = await db.from("profiles").select("user_id, favorite_topics").eq("digest_opt_in", true);
        if (error) throw new Error(error.message);
        const out: DigestUser[] = [];
        for (const p of (data ?? []) as { user_id: string; favorite_topics: string[] | null }[]) {
          const email = (await db.auth.admin.getUserById(p.user_id)).data.user?.email;
          if (email) out.push({ user_id: p.user_id, email, topics: p.favorite_topics ?? [] });
        }
        return out;
      },
      betsFor: async (topics) => {
        const page = marketsPage(store, FilterState.parse({ view: "flags", tier: "best", page_size: MAX_DIGEST_BETS, ...(topics.length ? { topics } : {}) }));
        return page.rows.slice(0, MAX_DIGEST_BETS).map(({ market: m, side }) => ({
          id: m.id, title: `${m.niche.toUpperCase()} · ${m.question}`, outcome: side.outcome, ask: side.ask, win_prob: side.win_prob, side_index: side.side_index, closes_at: m.closes_at,
        }));
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

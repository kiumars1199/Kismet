// OAuth / magic-link landing (docs/08, docs/14 §1): exchange the code for a session (HttpOnly cookies),
// record the 18+/Terms acceptance, then onboarding for new users or the `next` page (default Best bets).
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin/core";
import { adminEnabled, authEnabled, safeNext, supabaseAdmin, supabaseServer } from "@/lib/auth/server";
import { DEMO_MODE } from "@/lib/config";
import { getSettings } from "@/lib/settings";
import { takeTerms } from "@/lib/auth/terms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const go = (path: string) => NextResponse.redirect(new URL(path, url.origin), 303);
  const code = url.searchParams.get("code");
  // token_hash: a sign-in link an admin emailed from /admin (no PKCE verifier in this browser); the hash is the credential.
  const tokenHash = url.searchParams.get("token_hash");
  if (!authEnabled() || (!code && !tokenHash)) return go("/login?error=link");

  const supabase = await supabaseServer();
  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: "magiclink" });
  if (error || !data.user) return go(`/login?error=link&next=${encodeURIComponent(next)}`);

  const { data: profile } = await supabase
    .from("profiles").select("accepted_terms_at, onboarded_at").eq("user_id", data.user.id).maybeSingle();
  // Sign-ups closed (T-142): an account Google just created is removed again. Magic links can't create one
  // (shouldCreateUser: false). Admin emails are always let in.
  const created = Date.parse(data.user.created_at ?? "") || 0;
  if (!profile?.accepted_terms_at && Date.now() - created < 10 * 60_000 && !(await getSettings()).signups_open &&
      !isAdminEmail({ email: data.user.email, verified: !!data.user.email_confirmed_at }, process.env.ADMIN_EMAILS, DEMO_MODE)) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    const { error: delErr } = await supabaseAdmin().auth.admin.deleteUser(data.user.id);
    if (delErr) console.error("[auth/callback] closed sign-up cleanup failed", delErr.message);
    return go(`/login?error=closed&next=${encodeURIComponent(next)}`);
  }
  if (!profile?.accepted_terms_at) {
    const at = await takeTerms();
    if (!at) {
      await supabase.auth.signOut({ scope: "local" });
      return go(`/login?error=terms&next=${encodeURIComponent(next)}`);
    }
    // Server-owned column (RT-11): the database refuses it from the user's own JWT, so the service role writes it.
    if (!adminEnabled()) {
      await supabase.auth.signOut({ scope: "local" });
      return go(`/login?error=unavailable&next=${encodeURIComponent(next)}`);
    }
    const { error: saveErr } = await supabaseAdmin().from("profiles").update({ accepted_terms_at: at }).eq("user_id", data.user.id);
    if (saveErr) {
      await supabase.auth.signOut({ scope: "local" });
      return go(`/login?error=unavailable&next=${encodeURIComponent(next)}`);
    }
  }
  return go(profile?.onboarded_at ? next : `/onboarding?next=${encodeURIComponent(next)}`);
}

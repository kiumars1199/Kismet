// OAuth / magic-link landing (docs/08, docs/14 §1): exchange the code for a session (HttpOnly cookies),
// record the 18+/Terms acceptance, then onboarding for new users or the `next` page (default Best bets).
import { NextResponse } from "next/server";
import { authEnabled, safeNext, supabaseServer } from "@/lib/auth/server";
import { takeTerms } from "@/lib/auth/terms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const go = (path: string) => NextResponse.redirect(new URL(path, url.origin), 303);
  const code = url.searchParams.get("code");
  if (!authEnabled() || !code) return go("/login?error=link");

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return go(`/login?error=link&next=${encodeURIComponent(next)}`);

  const { data: profile } = await supabase
    .from("profiles").select("accepted_terms_at, onboarded_at").eq("user_id", data.user.id).maybeSingle();
  if (!profile?.accepted_terms_at) {
    const at = await takeTerms();
    if (!at) {
      await supabase.auth.signOut({ scope: "local" });
      return go(`/login?error=terms&next=${encodeURIComponent(next)}`);
    }
    await supabase.from("profiles").update({ accepted_terms_at: at }).eq("user_id", data.user.id);
  }
  return go(profile?.onboarded_at ? next : `/onboarding?next=${encodeURIComponent(next)}`);
}

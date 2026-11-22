import "server-only";
// T-276 admin activation: stamp profiles.first_bets_at once, on a signed-in user's first Best bets render.
// Best effort and after the response: before the owner applies 20261119000500_first_bets_visit.sql the column is
// missing, the update fails and nothing else changes. Service role, because the column is server-owned.
import { after } from "next/server";
import { defaultTopicsHref } from "@/lib/filters/default-topics";
import { adminEnabled, supabaseAdmin } from "@/lib/auth/server";

export function markFirstBetsVisit(userId: string, now = new Date()): void {
  if (!adminEnabled()) return;
  after(async () => {
    try {
      await supabaseAdmin().from("profiles").update({ first_bets_at: now.toISOString() }).eq("user_id", userId).is("first_bets_at", null);
    } catch { /* counts only; never break the page */ }
  });
}

/** F5: the query Best bets should redirect to so it opens filtered to the user's topics ("?fav=1" shows the "Your topics"
 *  pill), decided on the server so the first HTML is already filtered and nothing jumps. null = leave the URL alone
 *  (no topics, pill cleared, filters in the URL, signed out, or a failed read). A filter only: never a pick. */
export async function topicsRedirect(userId: string | null, search: string): Promise<string | null> {
  if (!userId || !adminEnabled()) return null;
  try {
    const { data, error } = await supabaseAdmin().from("profiles").select("favorite_topics, topics_off").eq("user_id", userId).maybeSingle();
    if (error || !data) return null;   // before 20261122000100_profile_topics_off.sql is applied the read fails: no redirect
    return defaultTopicsHref(search, data.favorite_topics ?? [], !!data.topics_off);
  } catch {
    return null;
  }
}

/** Nov 21: whether the "Choose your topics" nudge shows, decided on the server so it is in the first HTML. Drawn only
 *  after the profile loaded, it popped in about a second late and pushed every card down 62 px, so a tap aimed at a
 *  card landed on the gap. null = can't tell here (no admin access, a failed read): the client decides as before. */
export async function nudgeOnServer(userId: string | null, local: boolean): Promise<boolean | null> {
  if (!userId) return local ? true : null;   // demo / no accounts: the profile lives in this browser and starts empty
  if (!adminEnabled()) return null;
  try {
    const { data, error } = await supabaseAdmin().from("profiles").select("onboarded_at, favorite_topics").eq("user_id", userId).maybeSingle();
    if (error) return null;
    return !data?.onboarded_at && !(data?.favorite_topics?.length);
  } catch {
    return null;
  }
}

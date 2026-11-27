// F5: Home / Best bets open filtered to the topics the user chose, unless the URL already carries filters or the
// user cleared the "Your topics" pill. A filter only, never a pick: the same flags come back for anyone with it.
//
// Middleware can't query the database per request, so the choice rides in a small cookie the server writes whenever
// it learns the profile (profile save, /api/me): "<userId>|on:<ids>" or "<userId>|off:<ids>" (pill cleared). The cookie is only a hint, bound to the user id and cleared on sign-out; the profile is the source of truth. Middleware turns a bare
// /bets (or signed-in /) into a real 307 to /bets?fav=1&t=<ids>; the page then renders the filtered cards and the pill
// in its first HTML.
export const TOPICS_COOKIE = "me_topics";
export const TOPICS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;   // long-lived, so a returning user's first /bets already opens filtered; still only a hint: bound to the user id, rewritten from the profile on every /api/me, cleared on sign-out
const DRAWER = new Set(["m", "side", "_rsc"]);   // params that don't filter (the drawer; Next's soft-navigation marker)
const ID = /^[a-z0-9][a-z0-9._-]{0,59}$/;

/** "<userId>|on:<ids>" or "<userId>|off:<ids>": bound to the user, so another account on the same browser never reads it. */
export const topicsCookieValue = (userId: string, favorites: string[], off: boolean) => `${userId}|${off ? "off" : "on"}:${favorites.join(",")}`;

export function parseTopicsCookie(v: string | undefined | null, userId: string | undefined | null): { favorites: string[]; dismissed: boolean } {
  const bar = (v ?? "").indexOf("|");
  const m = userId && bar > 0 && v!.slice(0, bar) === userId ? /^(on|off):(.*)$/.exec(v!.slice(bar + 1)) : null;
  if (!m) return { favorites: [], dismissed: false };
  return { favorites: m[2]!.split(",").filter((id) => ID.test(id)).slice(0, 100), dismissed: m[1] === "off" };
}

/** The query to send the visitor to, or null to leave the URL alone. `search` is the request's query string. */
export function defaultTopicsHref(search: string, favorites: string[], dismissed: boolean): string | null {
  if (dismissed || !favorites.length) return null;
  const p = new URLSearchParams(search);
  for (const k of p.keys()) if (!DRAWER.has(k)) return null;
  p.delete("_rsc");
  // fav=1 is the "Your topics" pill; t=<ids> carries the same topics so the server renders the filtered list
  const out = new URLSearchParams({ fav: "1", t: favorites.join(",") });
  p.forEach((v, k) => out.set(k, v));
  return `?${out.toString()}`;
}

/** A "Your topics" link with no ids (fav=1 only: an old link, onboarding) resolves to the saved topics on the server.
 *  fav=0 is the cleared pill / "Everything": never resolved. */
export function wantsSavedTopics(params: URLSearchParams): boolean {
  const v = params.get("fav");
  return (v === "1" || v === "true") && !params.has("t");
}

/** On a saved-topics view (fav=1), a topics change that leaves the saved set also leaves "Your topics": the patch gets
 *  favorites_only:false, so the pill and the bar show the real topics, not a saved set that no longer applies. */
export function leaveSavedTopics<P extends { topics?: string[]; favorites_only?: boolean }>(state: { favorites_only?: boolean }, patch: P, saved: string[]): P & { favorites_only?: boolean } {
  if (!state.favorites_only || "favorites_only" in patch || !("topics" in patch)) return patch;
  const next = patch.topics ?? [];
  const same = next.length === saved.length && next.every((t) => saved.includes(t));
  return same ? patch : { ...patch, favorites_only: false };
}

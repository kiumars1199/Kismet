// F5: Home / Best bets open filtered to the topics the user chose, unless the URL already carries filters or the
// user cleared the "Your topics" pill. A filter only, never a pick: the same flags come back for anyone with it.
export const TOPICS_OFF_KEY = "me:v1:topics_off";
const DRAWER = new Set(["m", "side"]);

/** The query to replace the URL with, or null to leave it. `search` is location.search (with or without "?"). */
export function defaultTopicsHref(search: string, favorites: string[], dismissed: boolean): string | null {
  if (dismissed || !favorites.length) return null;
  const p = new URLSearchParams(search);
  for (const k of p.keys()) if (!DRAWER.has(k)) return null;
  // fav=1 is the "Your topics" pill; t=<ids> carries the same topics so the server renders the filtered list (no refetch after the profile loads)
  const out = new URLSearchParams({ fav: "1", t: favorites.join(",") });
  p.forEach((v, k) => out.set(k, v));
  return `?${out.toString()}`;
}

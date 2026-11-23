// F1: a pasted market link → which venue and which slug/ticker it names. Pure; resolveLink() finds the market.
import type { StoreMarket } from "@/lib/types";

export type ParsedLink = { venue: "polymarket" | "polymarket-us" | "kalshi"; parts: string[] };

/** Accepts polymarket.com/event/<slug>[/<market-slug>], polymarket.us/event/<slug> or /market/<slug>, and
 *  kalshi.com/markets/<series>[/<title>[/<ticker>]]. Anything else (or not a URL) → null. */
export function parseLink(input: string): ParsedLink | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return null;
  let url: URL;
  try { url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^(www|app|trade)\./, "");
  let segs: string[];
  try { segs = url.pathname.split("/").filter(Boolean).map((s) => decodeURIComponent(s)); } catch { return null; }
  const [kind, ...rest] = segs;
  if (host === "polymarket.com" && kind === "event" && rest.length) return { venue: "polymarket", parts: rest };
  if (host === "polymarket.us" && (kind === "event" || kind === "market") && rest.length) return { venue: "polymarket-us", parts: rest };
  if (host === "kalshi.com" && kind === "markets" && rest.length) return { venue: "kalshi", parts: rest };
  return null;
}

type Idx = { markets: StoreMarket[]; bySlug: Map<string, StoreMarket[]> };

/** The market the cards use for this link, or null. Prefers the most specific segment (market slug / ticker). */
export function resolveLink(p: ParsedLink, store: Idx): StoreMarket | null {
  const low = p.parts.map((s) => s.toLowerCase());
  const has = (v: string | null | undefined) => !!v && low.includes(v.toLowerCase());
  if (p.venue === "kalshi") return store.markets.find((m) => has(m.kalshi_ticker)) ?? null;
  if (p.venue === "polymarket") {
    const specific = store.markets.find((m) => m.venue !== "us" && has(m.market_slug));
    return specific ?? (store.bySlug.get(low[0]!) ?? []).find((m) => m.venue !== "us") ?? null;
  }
  // Polymarket US: a US-only market (id "us-…", slug = US event slug) or an international market with a US twin
  return store.markets.find((m) => has(m.us?.slug)) ?? store.markets.find((m) => m.venue === "us" && (has(m.market_slug) || has(m.slug))) ?? null;
}

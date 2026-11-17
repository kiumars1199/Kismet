// Search index (docs/04 § Search): AND match with prefix matching over question, event, outcomes,
// tags and niche; rank by token hits in the question. A pasted Polymarket URL or slug matches `slug`.
import type { Market } from "@/lib/types";

export const tokenize = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);

const SLUG_URL = /polymarket\.com\/(?:[a-z]{2}\/)?(?:event|market)\/([^/?#\s]+)/i;

export interface SearchIndex {
  /** Matching market ids → score (higher = better). Empty query → null (no filter). */
  find(q: string): Map<string, number> | null;
}

export function buildSearch(markets: Market[], bySlug: Map<string, Market[]>): SearchIndex {
  // One padded haystack per market: " tok tok … " so prefix match = includes(" " + token).
  const rows = markets.map((m) => ({
    id: m.id,
    all: ` ${tokenize([m.question, m.event, ...m.sides.map((s) => s.outcome), ...m.tags, m.niche].join(" ")).join(" ")} `,
    question: ` ${tokenize(m.question).join(" ")} `,
  }));

  return {
    find(q) {
      const raw = q.trim();
      if (!raw) return null;
      const slug = SLUG_URL.exec(raw)?.[1] ?? (/^[a-z0-9-]+$/i.test(raw) ? raw.toLowerCase() : null);
      const slugHits = slug ? bySlug.get(slug) : undefined;
      if (slugHits) return new Map(slugHits.map((m) => [m.id, 1]));

      const toks = tokenize(raw).map((t) => " " + t);
      if (!toks.length) return null;
      const out = new Map<string, number>();
      for (const r of rows) {
        if (!toks.every((t) => r.all.includes(t))) continue;
        out.set(r.id, toks.filter((t) => r.question.includes(t)).length);
      }
      return out;
    },
  };
}

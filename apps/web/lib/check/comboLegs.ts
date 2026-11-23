// The combo checker's legs, kept in sessionStorage so "Add to combo checker" from a card, the drawer or /m keeps the legs already
// chosen (T-wt3). Pure helpers (the browser calls sit in ComboClient); storage is per tab and never leaves the browser.
import { MAX_COMBO_LEGS } from "./combo";

export const STORE_KEY = "kismet.combo.legs.v1";

export interface StoredLeg { key: string; marketId: string; side: 0 | 1; question: string; outcome: string; eventId: string; event: string; price: number }

const isLeg = (x: unknown): x is StoredLeg => {
  const l = x as Partial<StoredLeg> | null;
  return !!l && typeof l === "object" && typeof l.key === "string" && typeof l.marketId === "string" && (l.side === 0 || l.side === 1)
    && typeof l.question === "string" && typeof l.outcome === "string" && typeof l.eventId === "string" && typeof l.event === "string"
    && typeof l.price === "number" && Number.isFinite(l.price);
};

/** What sessionStorage held: valid legs only, one per market, at most the combo maximum. Anything malformed is []. */
export function parseStored(raw: string | null): StoredLeg[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const seen = new Set<string>();
    const out: StoredLeg[] = [];
    for (const x of v) {
      if (!isLeg(x) || seen.has(x.marketId)) continue;
      seen.add(x.marketId);
      out.push(x);
      if (out.length >= MAX_COMBO_LEGS) break;
    }
    return out;
  } catch { return []; }
}

export function addStored(legs: StoredLeg[], leg: StoredLeg): { legs: StoredLeg[]; refused: "duplicate" | "full" | null } {
  if (legs.some((l) => l.marketId === leg.marketId)) return { legs, refused: "duplicate" };
  if (legs.length >= MAX_COMBO_LEGS) return { legs, refused: "full" };
  return { legs: [...legs, leg], refused: null };
}

/** How many legs this browser keeps, mirrored in an HttpOnly cookie (set by /api/check/legs) so the SERVER can reserve the legs
 *  list's height in the first HTML (sessionStorage is invisible to it). Session cookie, /check pages only, a count and nothing else. */
export const COUNT_COOKIE = "kismet_combo_n";

/** Legs to reserve room for on first paint: the cookie's count, and at least one when the URL carries a ?m= leg. */
export function reservedLegs(cookie: string | undefined, m: string | undefined): number {
  const n = Number.parseInt(cookie ?? "", 10);
  const kept = Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_COMBO_LEGS) : 0;
  return Math.max(kept, m ? 1 : 0);
}

export const readStored = (): StoredLeg[] => { try { return parseStored(sessionStorage.getItem(STORE_KEY)); } catch { return []; } };
export const writeStored = (legs: StoredLeg[]) => {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify(legs)); } catch {}
  // the count goes to the server (/api/check/legs sets an HttpOnly cookie): browser code sets no cookies
  try { void fetch("/api/check/legs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n: legs.length }), keepalive: true }).catch(() => {}); } catch {}
};

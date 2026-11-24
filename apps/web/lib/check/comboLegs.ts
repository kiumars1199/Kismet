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

/** Legs to reserve room for on first paint: one when the URL carries a ?m= leg (the server knows it from searchParams), else none.
 *  Legs kept in this tab's sessionStorage are invisible to the server, and nothing is shared across tabs to guess them: a reload with
 *  stored legs measured the same CLS without a reserve (0.0019 at 390), so there is none. */
export function reservedLegs(m: string | undefined): number {
  return m ? 1 : 0;
}

export const readStored = (): StoredLeg[] => { try { return parseStored(sessionStorage.getItem(STORE_KEY)); } catch { return []; } };
export const writeStored = (legs: StoredLeg[]) => { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(legs)); } catch {} };

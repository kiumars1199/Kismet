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

/** Legs to reserve room for on first paint: the legs in the URL (?legs=), or one for a ?m= leg. Legs kept in this tab's
 *  sessionStorage are not known to the server (no cookie: tabs do not share them); the legs region stays hidden until they are in. */
export function reservedLegs(m: string | undefined, legs?: string): number {
  return Math.max(m ? 1 : 0, parseLegsParam(legs).length);
}

/** The legs in the URL: /check/combo?legs=<id>:<side>,<id>:<side> (&check=1 scores them on load). Shared links and reloads carry
 *  every leg. Ids and sides are validated, duplicates dropped, at most the combo maximum; a missing side means 0. */
export interface LegRef { m: string; side: 0 | 1 }
const ID = /^[A-Za-z0-9._-]{1,120}$/;   // market ids never contain ":" (that separates the side)

export function parseLegsParam(v: string | null | undefined): LegRef[] {
  if (!v) return [];
  const out: LegRef[] = [];
  const seen = new Set<string>();
  for (const part of v.split(",")) {
    const bits = part.split(":");
    if (bits.length > 2) continue;
    const [m, side = "0"] = bits;
    if (!m || !ID.test(m) || !/^[01]$/.test(side) || seen.has(m)) continue;
    seen.add(m);
    out.push({ m, side: side === "1" ? 1 : 0 });
    if (out.length >= MAX_COMBO_LEGS) break;
  }
  return out;
}
export const legsParam = (refs: LegRef[]): string => refs.map((r) => `${r.m}:${r.side}`).join(",");
export function comboUrl(refs: LegRef[], check: boolean): string {
  if (!refs.length) return "/check/combo";
  const q = new URLSearchParams({ legs: legsParam(refs) });
  if (check) q.set("check", "1");
  return `/check/combo?${q}`;
}

export const readStored = (): StoredLeg[] => { try { return parseStored(sessionStorage.getItem(STORE_KEY)); } catch { return []; } };
export const writeStored = (legs: StoredLeg[]) => { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(legs)); } catch {} };

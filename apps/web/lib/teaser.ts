// T-276: what a signed-out visitor may see of one market or event: title, category, closing time. Nothing from the
// model (no verdict, edge, win chance, price or return), so /m/* and /event/* stay indexable without leaking it.
import "server-only";
import { cleanEventLine } from "@/lib/format";
import { getStoreFor } from "@/lib/data/store";
import { indexedMarketTeaser } from "@/lib/data/teasers";
import { TAXONOMY } from "@/lib/taxonomy";

export interface Teaser { kind: "market" | "event"; id: string; title: string; event?: string; category: string; closes_at: number | null; markets?: number;
  /** Walk-through 1: the market's own price (side 0 mid, 0..1) and that side's name. Public, not model output; markets only. */
  price?: number | null; price_outcome?: string }

const label = (c: string) => TAXONOMY[c]?.label ?? (c ? c[0]!.toUpperCase() + c.slice(1) : "Other");

export { cleanEventLine } from "@/lib/format";   // client-safe home: lib/format.ts

/** Only these keys ever leave this module. The compact teasers.json (lib/data/teasers.ts) answers first: a cold instance then
 *  reads a few hundred KB instead of parsing the whole store. Anything it can't answer falls through to the store. */
export async function marketTeaser(id: string): Promise<Teaser | null> {
  const t = await indexedMarketTeaser(id).catch(() => undefined);
  if (t) return teaserOf(t.id, t.question, t.event, t.category, t.closes_at, t.price, t.price_outcome);
  const store = await getStoreFor("free");
  const m = store.flagsById.get(id) ?? store.byId.get(id);
  if (!m) return null;
  return teaserOf(m.id, m.question, m.event, m.category, m.closes_at ?? null, typeof m.sides?.[0]?.mid === "number" ? m.sides[0].mid : null, m.sides?.[0]?.outcome);
}

function teaserOf(id: string, question: string, event: string, category: string, closes_at: number | null, price: number | null, price_outcome: string | undefined): Teaser {
  return { kind: "market", id, title: question, event: cleanEventLine(event) !== question ? cleanEventLine(event) : undefined, category: label(category), closes_at, price, price_outcome };
}

/** /signup?next=/m/<id>: the bet's title, read from the store by id (never from the URL). null = not a market link or unknown id. */
export async function signupBetTitle(next: string): Promise<string | null> {
  const id = /^\/m\/([^/?#]+)/.exec(next)?.[1];
  if (!id) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(id); } catch { return null; }
  return (await marketTeaser(decoded).catch(() => null))?.title ?? null;
}

export async function eventTeaser(id: string): Promise<Teaser | null> {
  const store = await getStoreFor("free");
  const ms = store.byEvent.get(id);
  if (!ms?.length) return null;
  const closes = ms.map((m) => m.closes_at).filter((t): t is number => typeof t === "number").sort((a, b) => a - b);
  return { kind: "event", id, title: cleanEventLine(ms[0]!.event), category: label(ms[0]!.category), closes_at: closes[0] ?? null, markets: ms.length };
}

export const TEASER_LINE = "Kismet has a verdict on this market. Sign up free to see it.";
export const TEASER_DESCRIPTION = "Kismet has a verdict on this market. Sign up free to see it. Market analytics, not financial advice.";

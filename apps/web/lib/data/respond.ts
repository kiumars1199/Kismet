// Server helpers shared by the API routes.
import { getStore, type Store } from "./store";
import { apply } from "@/lib/filters/apply";
import { RELAX_STEPS, relax, relaxedNote, type ParsedQuery } from "@/lib/search/parse";
import type { FilterState } from "@/lib/filters/state";
import type { EventResponse, MarketsResponse } from "@/lib/api";
import type { StoreMarket } from "@/lib/types";

/** Runs `fn` with the store; a store load failure becomes 503 instead of a crash. */
export async function withStore(fn: (store: Store) => Response | Promise<Response>, headers?: HeadersInit): Promise<Response> {
  let store: Store;
  try {
    store = await getStore();
  } catch (e) {
    console.error("[api] store load failed", e);
    return Response.json({ error: "Data is temporarily unavailable" }, { status: 503, headers });
  }
  return fn(store);
}

export const notFound = (what: string, headers?: HeadersInit) => Response.json({ error: `${what} not found` }, { status: 404, headers });

/** One page for the API. When q finds nothing, relax it step by step (docs/13 § honest fallback) and say so. */
export function marketsPage(store: Store, f: FilterState): MarketsResponse {
  let page = apply(store, f);
  const orig = page.parsed;
  if (page.total === 0 && orig) {
    let p: ParsedQuery = orig;
    for (const step of RELAX_STEPS) {
      const next = relax(p, step);
      if (!next) continue;
      p = next;
      const tried = apply(store, f, undefined, p);
      if (tried.total > 0) {
        page = { ...tried, search: { chips: orig.chips, relaxed: relaxedNote(orig, p) } };
        break;
      }
    }
  }
  const { parsed: _parsed, ...rest } = page;
  let start = 0;
  const groups = rest.groups?.map(({ rows, best: _best, ...g }) => {
    const out = { ...g, start, count: rows.length };
    start += rows.length;
    return out;
  });
  return { ...rest, groups };
}

const byRoi = (a: StoreMarket, b: StoreMarket) => b.best.roi_pct - a.best.roi_pct || a.closes_at - b.closes_at;

export function eventBody(store: Store, markets: StoreMarket[]): EventResponse {
  const sorted = [...markets].sort(byRoi);
  const m = sorted[0];
  return {
    event_id: m.event_id, event: m.event, slug: m.slug,
    markets: sorted,
    flags: sorted.flatMap((x) => store.flagsById.get(x.id) ?? []),
  };
}

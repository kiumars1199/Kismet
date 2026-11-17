// Server helpers shared by the API routes.
import { getStore, type Store } from "./store";
import { apply, type UserCtx } from "@/lib/filters/apply";
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

/** UserCtx from `uw` (watchlist market ids) and `uf` (favorite topic ids): the API is stateless, the client sends them. */
export function userCtx(p: URLSearchParams): UserCtx | undefined {
  const list = (k: string) => (p.get(k) ?? "").split(",").filter(Boolean).slice(0, 2000);
  if (!p.has("uw") && !p.has("uf")) return undefined;
  return { watchlist: new Set(list("uw")), favoriteTopics: list("uf") };
}

export function marketsPage(store: Store, f: FilterState, user?: UserCtx): MarketsResponse {
  const page = apply(store, f, user);
  let start = 0;
  const groups = page.groups?.map(({ rows, best: _best, ...g }) => {
    const out = { ...g, start, count: rows.length };
    start += rows.length;
    return out;
  });
  return { ...page, groups };
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

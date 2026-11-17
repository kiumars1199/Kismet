// Server helpers shared by the API routes.
import { getStore, getStoreFor, type Store } from "./store";
import { getMe, type Me } from "@/lib/auth/server";
import { gateMarket } from "./gate";
import type { Tier } from "@/lib/entitlements";
import { apply } from "@/lib/filters/apply";
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

/** Like withStore, for tier-shaped routes: resolves the caller's plan (server-side, docs/15) and serves free users
 *  the delayed scan. `fn` must shape its body with lib/data/gate.ts. */
export async function withTier(fn: (store: Store, tier: Tier, me: Me) => Response | Promise<Response>, headers?: HeadersInit): Promise<Response> {
  const me = await getMe();
  let store: Store;
  try {
    store = await getStoreFor(me.tier);
  } catch (e) {
    console.error("[api] store load failed", e);
    return Response.json({ error: "Data is temporarily unavailable" }, { status: 503, headers });
  }
  return fn(store, me.tier, me);
}

export const notFound = (what: string, headers?: HeadersInit) => Response.json({ error: `${what} not found` }, { status: 404, headers });

export function marketsPage(store: Store, f: FilterState): MarketsResponse {
  const page = apply(store, f);
  let start = 0;
  const groups = page.groups?.map(({ rows, best: _best, ...g }) => {
    const out = { ...g, start, count: rows.length };
    start += rows.length;
    return out;
  });
  return { ...page, groups };
}

const byRoi = (a: StoreMarket, b: StoreMarket) => b.best.roi_pct - a.best.roi_pct || a.closes_at - b.closes_at;

export function eventBody(store: Store, markets: StoreMarket[], tier: Tier = "premium"): EventResponse {
  const sorted = [...markets].sort(byRoi);
  const m = sorted[0];
  return {
    event_id: m.event_id, event: m.event, slug: m.slug,
    markets: sorted.map((x) => gateMarket(x, tier)),
    flags: sorted.flatMap((x) => store.flagsById.get(x.id) ?? []).map((x) => gateMarket(x, tier)),
  };
}

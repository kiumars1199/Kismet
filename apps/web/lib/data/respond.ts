// Server helpers shared by the API routes.
import { getStore, getStoreFor, type Store } from "./store";
import { getMe, type Me } from "@/lib/auth/server";
import { gateMarket, gateMarkets } from "./gate";
import { categoryRecord, curve, segmentOf } from "./model";
import { can, quota, type Tier } from "@/lib/entitlements";
import { apply } from "@/lib/filters/apply";
import { parse } from "@/lib/filters/url";
import { RELAX_STEPS, relax, relaxedNote, type ParsedQuery } from "@/lib/search/parse";
import type { FilterState } from "@/lib/filters/state";
import type { EventResponse, MarketResponse, MarketsResponse } from "@/lib/api";
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

/** First `quota(tier, "rows")` items (Free: 25 rows per request, docs/08). */
const capRows = <T,>(list: T[], tier: Tier) => list.slice(0, quota(tier, "rows"));

export function eventBody(store: Store, markets: StoreMarket[], tier: Tier = "premium"): EventResponse {
  const sorted = [...markets].sort(byRoi);
  const m = sorted[0];
  return {
    event_id: m.event_id, event: m.event, slug: m.slug,
    markets: capRows(sorted, tier).map((x) => gateMarket(x, tier)),
    flags: capRows(sorted.flatMap((x) => store.flagsById.get(x.id) ?? []), tier).map((x) => gateMarket(x, tier)),
  };
}

/** /api/markets/[id] and the /m/[id] page. `shown` = the tier the market itself is shaped for (a Free reveal = "pro"). */
export function marketBody(store: Store, m: StoreMarket, tier: Tier, shown: Tier = tier): MarketResponse {
  const segment = segmentOf(m);
  return {
    market: gateMarket(store.flagsById.get(m.id) ?? m, shown),   // the flag row carries best.realistic_edge
    segment,
    curve: curve(store.model, segment, m.horizon_h),
    backtest: categoryRecord(store.backtest, m.category),
    event_markets: capRows((store.byEvent.get(m.event_id) ?? []).filter((x) => x.id !== m.id), tier).map((x) => gateMarket(x, tier)),
  };
}

/** GET /api/markets and /api/flags. Free: first page only (top 25 rows), exact numbers as ranges (docs/08 LIMITS).
 *  Paid: a page past the last one is refused (docs/15 § pagination cap) instead of answered empty. */
export const listRoute = (req: Request, view?: "flags") =>
  withTier((store, tier) => {
    const f = { ...parse(new URL(req.url).searchParams), ...(view ? { view } : {}) };
    const live = can(tier, "live_data");
    const page = marketsPage(store, live ? f : { ...f, page: 1 });
    if (live && f.page > Math.max(1, page.pages)) return Response.json({ error: "page is past the last page" }, { status: 400 });
    return Response.json(gateMarkets(page, tier));
  });

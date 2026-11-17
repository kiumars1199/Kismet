// Server helpers shared by the API routes.
import { getStore, getStoreFor, type Store } from "./store";
import { botCheck, clientKey, noteRows, rateLimit, type Rule } from "@/lib/abuse";
import { getMe, type Me } from "@/lib/auth/server";
import { gateMarket, gateMarkets } from "./gate";
import { categoryRecord, curve, segmentOf } from "./model";
import { can, quota, type Tier } from "@/lib/entitlements";
import { apply, nowFor, openOnly } from "@/lib/filters/apply";
import { parse } from "@/lib/filters/url";
import { RELAX_STEPS, relax, relaxedNote, type ParsedQuery } from "@/lib/search/parse";
import { BEST_BETS_VERDICTS, type FilterState } from "@/lib/filters/state";
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

/** Like withStore, for tier-shaped routes: resolves the caller's plan (server-side, docs/15), runs BotID and the
 *  route's rate limit (before the store load, so a refused request costs nothing), and serves free users the
 *  delayed scan. `fn` must shape its body with lib/data/gate.ts. `bot: false` = no BotID (extension-facing routes). */
export async function withTier(
  req: Request, rule: Rule,
  fn: (store: Store, tier: Tier, me: Me) => Response | Promise<Response>,
  { headers, bot = true }: { headers?: HeadersInit; bot?: boolean } = {},
): Promise<Response> {
  const me = await getMe();
  const refused = (bot ? await botCheck() : null) ?? (await rateLimit(rule, clientKey(req, me.user?.id)));
  if (refused) return refused;
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

/** Open markets of one event; null once every one has closed (routes answer 404). */
export function eventBody(store: Store, markets: StoreMarket[], tier: Tier = "premium"): EventResponse | null {
  const sorted = openOnly(markets, nowFor(store)).sort(byRoi);
  const m = sorted[0];
  if (!m) return null;
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
    event_markets: capRows(openOnly(store.byEvent.get(m.event_id) ?? [], nowFor(store)).filter((x) => x.id !== m.id), tier).map((x) => gateMarket(x, tier)),
  };
}

/** GET /api/markets and /api/flags. Free: first page only (top 25 rows), exact numbers as ranges (docs/08 LIMITS).
 *  Paid: a page past the last one is refused (docs/15 § pagination cap) instead of answered empty. */
export const listRoute = (req: Request, view?: "flags") =>
  withTier(req, "markets", async (store, tier, me) => {
    const f = { ...parse(new URL(req.url).searchParams), ...(view ? { view } : {}) };
    const live = can(tier, "live_data");
    if (live && f.page > 1) {
      const refused = await rateLimit("pages", clientKey(req, me.user?.id));   // max 50 pages a minute
      if (refused) return refused;
    }
    const page = marketsPage(store, live ? f : { ...f, page: 1 });
    if (live && f.page > Math.max(1, page.pages)) return Response.json({ error: "page is past the last page" }, { status: 400 });
    const body = gateMarkets(page, tier);
    await noteRows(req, me.user?.id, body.rows.length);
    return Response.json(body);
  });

/** Best bets headline count for the first server paint: the same query, store and gate as /api/flags page 1, so
 *  the headline doesn't change when the cards load (LCP stays at first paint). undefined when it can't match the
 *  browser's query (fav/wl resolve on the device) or on any failure. */
export async function flagsTotal(params: URLSearchParams): Promise<number | undefined> {
  if (params.has("fav") || params.has("wl")) return undefined;
  try {
    const me = await getMe();
    const store = await getStoreFor(me.tier);
    const f = parse(params);
    const state = { ...f, view: "flags" as const, verdicts: params.has("vd") ? f.verdicts : BEST_BETS_VERDICTS, page: 1 };
    return gateMarkets(marketsPage(store, state), me.tier).total;
  } catch {
    return undefined;
  }
}

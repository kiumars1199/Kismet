// Server helpers shared by the API routes.
import { DelayedPending, getStore, getStoreFor, type Store } from "./store";
import { botCheck, clientKey, noteRows, rateLimit, rowBudget, verifiedBot, type Rule } from "@/lib/abuse";
import { getMe, type Me } from "@/lib/auth/server";
import { freeView, gateMarket, gateMarkets } from "./gate";
import { categoryRecord, curve, segmentOf } from "./model";
import { can, type Tier } from "@/lib/entitlements";
import { delayMin, rowCap } from "@/lib/settings-core";
import { apply, nowFor, openOnly } from "@/lib/filters/apply";
import { parse } from "@/lib/filters/url";
import { RELAX_STEPS, relax, relaxedNote, type ParsedQuery } from "@/lib/search/parse";
import { BEST_BETS_VERDICTS, type FilterState } from "@/lib/filters/state";
import { DELAYED_PENDING, delayedPendingLine, type EventResponse, type MarketResponse, type MarketsResponse } from "@/lib/api";
import type { StoreMarket } from "@/lib/types";
import { headers } from "next/headers";

/** RT-15: tier-shaped bodies must never sit in a shared cache. A route's own private Cache-Control is kept. */
export function noStore(res: Response): Response {
  if (!/\bprivate\b|no-store/.test(res.headers.get("cache-control") ?? "")) res.headers.set("Cache-Control", "private, no-store");
  res.headers.append("Vary", "Cookie");
  return res;
}

/** The store for `tier` (undefined = the newest scan); a load failure becomes a private 503 Response instead of a crash.
 *  Free with no delayed copy yet gets the honest "first update shortly" body (code DELAYED_PENDING). */
async function loadStore(tier: Tier | undefined, headers?: HeadersInit): Promise<Store | Response> {
  try {
    return tier ? await getStoreFor(tier) : await getStore();
  } catch (e) {
    if (e instanceof DelayedPending) {
      console.warn(e.message);
      const h = new Headers(headers);
      h.set("Retry-After", "60");
      return noStore(Response.json({ error: delayedPendingLine(delayMin("free")), code: DELAYED_PENDING }, { status: 503, headers: h }));
    }
    console.error("[api] store load failed", e);
    return noStore(Response.json({ error: "Data is temporarily unavailable" }, { status: 503, headers }));
  }
}

/** Runs `fn` with the store; a store load failure becomes 503 instead of a crash. With `tier`, Free gets the
 *  delayed scan (getStoreFor), so scan meta matches the data that tier sees; the body is private either way. */
export async function withStore(fn: (store: Store) => Response | Promise<Response>, headers?: HeadersInit, tier?: Tier): Promise<Response> {
  const store = await loadStore(tier, headers);
  if (store instanceof Response) return store;
  return noStore(await fn(store));
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
  if (refused) return noStore(refused);
  const store = await loadStore(me.tier, headers);
  if (store instanceof Response) return store;
  return noStore(await fn(can(me.tier, "exact_edge") ? store : freeView(store), me.tier, me));   // RT-04: Free filters on what it sees
}

/** Server Components: the honest "first update shortly" line when Free has no delayed scan yet; any other error rethrows. */
export function pendingLine(e: unknown): string {
  if (e instanceof DelayedPending) return delayedPendingLine(delayMin("free"));
  throw e;
}

/** A page load refused by pageStore / pageBudget (RT3-02): the page renders its "slow down" state. */
export class SlowDown extends Error {
  constructor() { super("rate limited"); }
}

/** RT3-02: /m/[id] and /event/[id] page loads carry the same data as /api/markets/[id] and /api/events/[id], so they
 *  get the same `markets` rate limit (keyed like the API: user id, else platform IP), checked before the store load.
 *  Throws SlowDown when refused. Wrap the page's load() in React cache() so generateMetadata and the page count once. */
export async function pageStore(): Promise<{ store: Store; tier: Tier; me: Me; req: Request; bot: boolean }> {
  const [me, h, bot] = await Promise.all([getMe(), headers(), verifiedBot()]);
  const req = new Request("http://page/", { headers: h });
  if (!bot && (await rateLimit("markets", clientKey(req, me.user?.id)))) throw new SlowDown();
  return { store: await getStoreFor(me.tier), tier: me.tier, me, req, bot };
}

/** RT3-02: Free / signed-out page loads count the markets they show against the RT-03 distinct-row budget
 *  (FREE_ROWS_PER_HOUR, shared with the list routes). Throws SlowDown past it. Paid tiers: no budget, like the API. */
export async function pageBudget({ tier, me, req, bot }: { tier: Tier; me: Me; req: Request; bot?: boolean }, ids: string[]): Promise<void> {
  if (can(tier, "live_data") || bot) return;   // verified search bots: owner decision, see verifiedBot()
  if (await rowBudget(req, me.user?.id, ids)) throw new SlowDown();
  await noteRows(req, me.user?.id, ids.length);
}

export const notFound =(what: string, headers?: HeadersInit) => Response.json({ error: `${what} not found` }, { status: 404, headers });

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

/** First `rowCap(tier)` items (Free: 10 rows per request by default, docs/08; site settings can change it). */
const capRows = <T,>(list: T[], tier: Tier) => list.slice(0, rowCap(tier));

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
    curve: can(shown, "exact_edge") ? curve(store.model, segment, m.horizon_h) : null,   // RT3-01: curve + mid = exact win chance
    backtest: categoryRecord(store.backtest, m.category),
    event_markets: capRows(openOnly(store.byEvent.get(m.event_id) ?? [], nowFor(store)).filter((x) => x.id !== m.id), tier).map((x) => gateMarket(x, tier)),
  };
}

/** 32-bit FNV-1a: a cheap, stable hash for the Free daily sample (not a secret, only a shuffle). */
function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** docs/19 P3: Free sees `rowCap("free")` Best bets a day, a random sample per user (or IP) per UTC day, so a refresh
 *  doesn't change it. Consistent sampling: each open best-tier bet ranks by hash(key + day + id) and the lowest N win,
 *  so a new scan only swaps the bets that closed or appeared. */
export function freeSample(store: Store, key: string, now = Date.now()): Set<string> {
  const seed = `${key}|${new Date(now).toISOString().slice(0, 10)}|`;
  const t = nowFor(store);
  return new Set(
    store.flags
      .filter((m) => m.closes_at > t && (m.tier ?? "best") === "best" && !!m.execution && BEST_BETS_VERDICTS.includes(m.execution.verdict))
      .map((m) => [fnv(seed + m.id), m.id] as const)
      .sort((a, b) => a[0] - b[0])
      .slice(0, rowCap("free"))
      .map(([, id]) => id),
  );
}

/** Free Best bets: every match is counted (`total` is the real N for "Unlock all N bets"), but only the day's sample
 *  leaves the server, ungrouped (a game group would carry the other bets in it). */
function freeFlagsPage(store: Store, f: FilterState, key: string): MarketsResponse {
  const page = marketsPage(store, { ...f, page: 1, page_size: Number.MAX_SAFE_INTEGER, group_by_event: false });
  const keep = freeSample(store, key);
  const rows = page.rows.filter((r) => keep.has(r.market.id));
  return { ...page, page_size: f.page_size, total_groups: undefined, groups: undefined, rows };
}

/** GET /api/markets and /api/flags. Free: first page only (top 10 rows), exact numbers as ranges (docs/08 LIMITS);
 *  Best bets are the day's sample (freeSample). Paid: a page past the last one is refused (docs/15 § pagination cap). */
export const listRoute = (req: Request, view?: "flags") =>
  withTier(req, "markets", async (store, tier, me) => {
    const f = { ...parse(new URL(req.url).searchParams), ...(view ? { view } : {}) };
    const live = can(tier, "live_data");
    if (live && f.page > 1) {
      const refused = await rateLimit("pages", clientKey(req, me.user?.id));   // max 50 pages a minute
      if (refused) return refused;
    }
    if (!live) {
      const refused = await rateLimit("list_free", clientKey(req, me.user?.id));   // RT-03: 30 a minute
      if (refused) return refused;
    }
    const page = live ? marketsPage(store, f) : f.view === "flags" ? freeFlagsPage(store, f, clientKey(req, me.user?.id)) : marketsPage(store, { ...f, page: 1 });
    if (live && f.page > Math.max(1, page.pages)) return Response.json({ error: "page is past the last page" }, { status: 400 });
    const body = gateMarkets(page, tier);
    const over = live ? null : await rowBudget(req, me.user?.id, body.rows.map((r) => r.market.id));   // RT-03
    if (over) return over;
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
    const live = await getStoreFor(me.tier);
    const store = can(me.tier, "exact_edge") ? live : freeView(live);
    const f = parse(params);
    const state = { ...f, view: "flags" as const, verdicts: params.has("vd") ? f.verdicts : BEST_BETS_VERDICTS, page: 1 };
    return gateMarkets(marketsPage(store, state), me.tier).total;
  } catch {
    return undefined;
  }
}

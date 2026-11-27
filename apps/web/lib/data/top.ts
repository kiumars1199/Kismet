// T-295 (docs/OVERHAUL.md §C, docs/03 § Precomputed files): the small files the engine writes after each scan.
// top.json holds every Best bets row (a few hundred, ~0.5 MB gzipped) instead of ~35 MB of markets + flags, so the
// landing page and /about build from it in milliseconds on a cold instance. The rows go through the same buildStore,
// freeView, apply, listBody and gate code as the full store, so what a tier sees is the same "as today".
// Missing, unreadable or stale files = undefined, and callers fall back to the full store (topOrStore).
// Server only.
import "server-only";
import { delayMin } from "@/lib/settings-core";
import { getSettings } from "@/lib/settings";
import type { Tier } from "@/lib/entitlements";
import type { BacktestFile, CountsFile, LedgerSummary, ModelFile, ScanMeta, TopFile, VenuesFile } from "@/lib/types";
import { buildStore, firstFlaggedAt, forgetVersion, getStoreFor, readSource, sourceChain, type Store } from "./store";
import { headlineBacktest } from "./model";
import { DATA_SOURCE } from "@/lib/config";

/** Small files: re-read often, so a regeneration right after an upload (ops/upload.py → /api/revalidate) sees the new scan. */
const TTL_MS = 30_000;
/** A top.json this much older than now is from a publisher that stopped writing it: ignore it (DATA_CLOCK=scan: never). */
export const TOP_MAX_AGE_S = 3600;

/** `rechecked`: the counts.json scanned_at this file was already re-read against (the stale-guard's one re-read per scan; kept across TTL refreshes). */
type Entry<T> = { at: number; value: T | undefined; inflight?: Promise<T | undefined>; freshInflight?: Promise<T | undefined>; rechecked?: number };
const g = globalThis as unknown as { __meTop?: Map<string, Entry<unknown>>; __meTopStores?: Map<string, Store> };
const files = (g.__meTop ??= new Map());
const stores = (g.__meTopStores ??= new Map());

/** Drop every cached small file and store on this instance (the revalidate route calls it before regenerating). */
export function resetTop() {
  files.clear();
  stores.clear();
  forgetVersion();   // an upload just finished: read its version.json now, so the regeneration doesn't reuse an older copy
  // the teaser index (lib/data/teasers.ts) is checked against counts.json too: out of step, it would trip the stale-guard
  (globalThis as unknown as { __meTeasers?: Map<string, unknown> }).__meTeasers?.clear();
}

/** A JSON file from the configured source chain; undefined when missing or unreadable (logged). Cached TTL_MS. */
function cachedJson<T>(file: string, fresh = false, forScan?: number): Promise<T | undefined> {
  const hit = files.get(file) as Entry<T> | undefined;
  // fresh: read it again whatever the cache holds (the stale-guard's one re-read when counts.json is ahead of this copy)
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.value);
  if (!fresh && hit?.inflight) return hit.inflight;
  if (fresh && hit?.freshInflight) return hit.freshInflight;   // concurrent re-reads share one read
  const inflight = readSource(file, sourceChain(DATA_SOURCE))
    .then((text) => (text === undefined ? undefined : (JSON.parse(text) as T)))
    .catch((e) => { console.warn(`[top] ${file} unreadable: ${(e as Error).message}`); return undefined; })
    .then((value) => { files.set(file, { at: Date.now(), value, rechecked: fresh ? forScan : (files.get(file) as Entry<T> | undefined)?.rechecked }); return value; });
  files.set(file, { at: hit?.at ?? 0, value: hit?.value, rechecked: hit?.rechecked, ...(fresh ? { inflight: hit?.inflight, freshInflight: inflight } : { inflight, freshInflight: hit?.freshInflight }) });
  return inflight;
}

/** Shape check: enough to trust the file (the engine writes it; rows are validated again by buildStore's sample). */
const isTop = (f: unknown): f is TopFile =>
  !!f && typeof f === "object" && Array.isArray((f as TopFile).rows) && typeof (f as TopFile).meta?.scanned_at === "number";

export interface Results {
  model: ModelFile;
  backtest: BacktestFile;
  ledgerSummary?: LedgerSummary;
  ledgerSince: number | null;
  /** The scan's meta (the flag rule) from counts.json; `{}` when that file is missing. */
  meta: Partial<ScanMeta>;
}

/** model.json, backtest.json, ledger_summary.json, the live record's start and the scan meta: what /track-record,
 *  /pricing and the landing tiles read. ~0.7 MB instead of the full store. Throws when model or backtest is missing. */
export async function getResults(): Promise<Results> {
  const [model, backtest, ledgerSummary, counts] = await Promise.all([
    cachedJson<ModelFile>("model.json"), cachedJson<BacktestFile>("backtest.json"), cachedJson<LedgerSummary>("ledger_summary.json"), getCounts(),
  ]);
  const meta = counts?.meta ?? {};
  if (!model || !backtest) {
    // `next build` prerenders /pricing and /track-record: with no engine output reachable there, build them empty
    // (the pages show no figures) rather than fail the deploy; the first revalidation fills them. At run time throw,
    // so a regeneration that cannot read the data keeps the last good page (ISR).
    if (process.env.NEXT_PHASE === "phase-production-build") {
      console.warn("[top] model.json or backtest.json missing at build: prerendering without results");
      return { model: { half_life_days: null, fitted_at: 0, nodes: [] } as unknown as ModelFile, backtest: {} as BacktestFile, ledgerSince: null, meta };
    }
    throw new Error("[top] model.json or backtest.json missing");
  }
  const ledgerSince = ledgerSummary ? await firstFlaggedAt(sourceChain(DATA_SOURCE)[0]!).catch(() => null) : null;
  return { model, backtest: headlineBacktest(backtest), ledgerSummary, ledgerSince, meta };   // Nov 21: even-weeks run first
}

/** Free tier: the newest copy whose scan is at least the delay old (same rule as getStoreFor). */
export function pickTop(copies: (TopFile | undefined)[], cutoff: number): TopFile | undefined {
  return copies.filter((c): c is TopFile => !!c && c.meta.scanned_at <= cutoff).sort((a, b) => b.meta.scanned_at - a.meta.scanned_at)[0];
}

const stale = (f: TopFile, now = Date.now() / 1000) => process.env.DATA_CLOCK !== "scan" && now - f.meta.scanned_at > TOP_MAX_AGE_S;

/** The Best bets rows `tier` may see, as a Store (markets = flags = those rows), or undefined (caller falls back).
 *  `category`: live tiers only, the top-<category>.json subset of the same scan. */
export async function getTopStore(tier: Tier, category?: string): Promise<Store | undefined> {
  // top.json and counts.json together (one round trip on a cold instance); getSettings: the Free delay
  const [first, counts] = await Promise.all([cachedJson<TopFile>("top.json"), getCounts(), getSettings()]);
  let newest = first;
  if (!isTop(newest) || stale(newest)) return undefined;
  // A top.json older than the newest counts.json is either a leftover from a scan whose precompute failed (the publisher never
  // deletes bucket objects; T-295 left this gap) or just a cached copy from before this scan (the caches expire on their own
  // clocks, and a normal upload puts counts.json up first): read it once more, bypassing the cache. Still older = a leftover:
  // serve from the full store instead. No counts file = nothing to compare.
  // At most once per counts scan (entry.rechecked): a real leftover must not turn every request into a bucket read.
  if (counts && newest.meta.scanned_at < counts.scanned_at) {
    if ((files.get("top.json") as Entry<TopFile> | undefined)?.rechecked === counts.scanned_at) return undefined;
    newest = await cachedJson<TopFile>("top.json", true, counts.scanned_at);
    if (!isTop(newest) || stale(newest) || newest.meta.scanned_at < counts.scanned_at) return undefined;
  }
  const delay = delayMin(tier);
  if (delay > 0) {
    const cutoff = Date.now() / 1000 - delay * 60;
    let file = pickTop([newest], cutoff);
    if (!file) {
      const [prev, prev2] = await Promise.all([cachedJson<TopFile>("top-prev.json"), cachedJson<TopFile>("top-prev2.json")]);
      file = pickTop([prev, prev2].filter(isTop), cutoff);
    }
    return file && storeOf(file);   // nothing old enough: undefined, the full store's own copies decide (or DelayedPending)
  }
  if (category) {
    const sub = await cachedJson<TopFile>(`top-${category}.json`);
    // a category with no rows has no file: an empty store of the same scan, not a fallback
    return storeOf(isTop(sub) && sub.meta.scanned_at === newest.meta.scanned_at ? sub : { ...newest, total: 0, rows: [] });
  }
  return storeOf(newest);
}

async function storeOf(file: TopFile): Promise<Store> {
  const key = `${file.meta.scanned_at}|${file.query?.category ?? ""}|${file.rows.length}`;
  const hit = stores.get(key);
  if (hit) return hit;
  const results = await getResults().catch(() => undefined);
  const venues = await cachedJson<VenuesFile>("venues.json");   // F4: the same quotes the full store merges (missing = none)
  const rows = file.rows.map((r) => r.market);
  const store = buildStore({
    markets: { meta: file.meta, markets: rows }, flags: { meta: file.meta, flags: rows },
    model: results?.model ?? ({ half_life_days: null, fitted_at: 0, nodes: [] } as ModelFile),
    backtest: results?.backtest ?? ({} as BacktestFile),
    ledgerSummary: results?.ledgerSummary, ledgerSince: results?.ledgerSince ?? null, venues,
  });
  if (stores.size > 8) stores.clear();
  stores.set(key, store);
  return store;
}

/** The store a page builds Best bets content from: top.json when it can serve `tier`, else the full store (which may
 *  throw DelayedPending for Free, exactly as before). */
export async function topOrStore(tier: Tier): Promise<Store> {
  try {
    const top = await getTopStore(tier);
    if (top) return top;
  } catch (e) {
    console.warn(`[top] fast path failed, using the full store: ${(e as Error).message}`);
  }
  return getStoreFor(tier);
}

/** counts.json (scan-time counts), or undefined. */
export async function getCounts(): Promise<CountsFile | undefined> {
  const c = await cachedJson<CountsFile>("counts.json");
  return c && typeof c.scanned_at === "number" && c.best_bets ? c : undefined;
}

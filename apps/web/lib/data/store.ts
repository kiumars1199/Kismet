// In-memory data store (docs/02 § Data flow): one parsed copy per server instance, 120 s cache,
// concurrent loads de-duplicated. Server only — never ship markets.json to the browser.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DATA_SOURCE, dataDirSetting, github, supabaseStorage, type DataSource } from "@/lib/config";
import { DELAY_MIN, type Tier } from "@/lib/entitlements";
import { Flag as FlagSchema, Market as MarketSchema, ScanMeta as MetaSchema } from "@/lib/schemas";
import type { BacktestFile, EventsFile, FlagsFile, LedgerSummary, MarketsFile, ModelFile, ScanMeta, StoreMarket } from "@/lib/types";
import { derive } from "./derive";
import { buildSearch, type SearchIndex } from "@/lib/search/index";

export interface RawData {
  markets: MarketsFile;
  flags: FlagsFile;
  model: ModelFile;
  backtest: BacktestFile;
  events?: EventsFile;              // output/events.json (T-05), optional
  ledgerSummary?: LedgerSummary;    // output/ledger_summary.json (T-04), optional
  source?: DataSource;              // which source served this copy
}

export type Counts = Record<string, number>;

export interface Store {
  loadedAt: number;
  meta: ScanMeta;
  markets: StoreMarket[];
  flags: StoreMarket[];                     // flags.json rows (always carry `execution`)
  byId: Map<string, StoreMarket>;
  byEvent: Map<string, StoreMarket[]>;
  bySlug: Map<string, StoreMarket[]>;       // event slug → markets
  flagsById: Map<string, StoreMarket>;
  facets: { categories: Counts; niches: Counts; market_types: Counts; periods: Counts; frequency: Counts };
  search: SearchIndex;
  model: ModelFile;
  backtest: BacktestFile;
  events?: EventsFile;
  ledgerSummary?: LedgerSummary;
  source?: DataSource;
}

const TTL_MS = 120_000;
const dataDir = () => path.resolve(process.cwd(), dataDirSetting());

const push = <K, V>(map: Map<K, V[]>, k: K, v: V) => {
  const list = map.get(k);
  if (list) list.push(v);
  else map.set(k, [v]);
};
const inc = (c: Counts, k: string) => (c[k] = (c[k] ?? 0) + 1);

/** Validate meta + ~1% of rows; log problems, never throw. */
function validate(file: string, meta: unknown, rows: unknown[], schema: typeof MarketSchema | typeof FlagSchema) {
  const m = MetaSchema.safeParse(meta);
  if (!m.success) console.warn(`[store] ${file} meta mismatch`, m.error.issues.slice(0, 3));
  let bad = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const r = schema.safeParse(rows[i]);
    if (!r.success && bad++ < 3) console.warn(`[store] ${file} row ${i} mismatch`, r.error.issues.slice(0, 3));
  }
}

export function buildStore(raw: RawData, loadedAt = Date.now()): Store {
  validate("markets.json", raw.markets.meta, raw.markets.markets, MarketSchema);
  validate("flags.json", raw.flags.meta, raw.flags.flags, FlagSchema);

  const flags: StoreMarket[] = raw.flags.flags.map((f) => ({ ...f, derived: derive(f) }));
  const flagsById = new Map(flags.map((f) => [f.id, f]));
  const markets: StoreMarket[] = raw.markets.markets.map((m) => {
    const execution = (m as StoreMarket).execution ?? flagsById.get(m.id)?.execution;
    return { ...m, ...(execution ? { execution } : {}), derived: derive(m) };
  });

  const byId = new Map<string, StoreMarket>();
  const byEvent = new Map<string, StoreMarket[]>();
  const bySlug = new Map<string, StoreMarket[]>();
  const facets: Store["facets"] = { categories: {}, niches: {}, market_types: {}, periods: {}, frequency: {} };
  for (const m of markets) {
    byId.set(m.id, m);
    push(byEvent, m.event_id, m);
    push(bySlug, m.slug.toLowerCase(), m);
    inc(facets.categories, m.category);
    inc(facets.niches, m.niche);
    inc(facets.market_types, m.market_type);
    inc(facets.periods, m.derived.period);
    for (const f of m.derived.frequency) inc(facets.frequency, f);
  }

  return {
    loadedAt,
    meta: raw.markets.meta,
    markets,
    flags,
    byId,
    byEvent,
    bySlug,
    flagsById,
    facets,
    search: buildSearch(markets, bySlug),
    model: raw.model,
    backtest: raw.backtest,
    events: raw.events,
    ledgerSummary: raw.ledgerSummary,
    source: raw.source,
  };
}

/** Sources tried in order (docs/14 §4): supabase → GitHub `live` branch; getStore adds the last good copy. */
export const sourceChain = (s: DataSource = DATA_SOURCE): DataSource[] => (s === "supabase" ? ["supabase", "github"] : [s]);

async function fetchText(url: string, headers: Record<string, string>, missing: number[]) {
  const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (missing.includes(res.status)) return undefined;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** One file from one source; undefined = the source has no such file. */
async function readFrom(source: DataSource, file: string): Promise<string | undefined> {
  if (source === "supabase") {
    const { url, key, bucket } = supabaseStorage();
    if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
    // Storage answers 400 (not 404) for a missing object.
    return fetchText(`${url}/storage/v1/object/authenticated/${bucket}/${file}`, { Authorization: `Bearer ${key}`, apikey: key }, [400, 404]);
  }
  if (source === "github") {
    const { token, repo, ref } = github();
    return fetchText(`https://api.github.com/repos/${repo}/contents/${file}?ref=${ref}`,
      { Accept: "application/vnd.github.raw", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, [404]);
  }
  try {
    return await readFile(path.join(dataDir(), file), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw e;
  }
}

/** One file from the first source that has it. */
export async function readSource(file: string, chain = sourceChain()): Promise<string | undefined> {
  let err: unknown;
  for (const source of chain) {
    try {
      const text = await readFrom(source, file);
      if (text !== undefined) return text;
    } catch (e) {
      err = e;
      console.warn(`[store] ${source} ${file} failed: ${(e as Error).message}`);
    }
  }
  if (err) throw err;
  return undefined;
}

async function loadFrom(source: DataSource): Promise<RawData> {
  const read = async <T>(file: string, required: boolean): Promise<T | undefined> => {
    const text = await readFrom(source, file);
    if (text === undefined && required) throw new Error(`missing ${file} (DATA_SOURCE=${source}, dir=${dataDir()})`);
    return text === undefined ? undefined : (JSON.parse(text) as T);
  };
  const [markets, flags, model, backtest, events, ledgerSummary] = await Promise.all([
    read<MarketsFile>("markets.json", true),
    read<FlagsFile>("flags.json", true),
    read<ModelFile>("model.json", true),
    read<BacktestFile>("backtest.json", true),
    read<EventsFile>("events.json", false),
    read<LedgerSummary>("ledger_summary.json", false),
  ]);
  return { markets: markets!, flags: flags!, model: model!, backtest: backtest!, events, ledgerSummary, source };
}

/** Every file from one source (never mix two scans); on any failure the next source. */
export async function loadRaw(chain = sourceChain()): Promise<RawData> {
  let err: unknown;
  for (const source of chain) {
    try {
      return await loadFrom(source);
    } catch (e) {
      err = e;
      console.warn(`[store] ${source} load failed: ${(e as Error).message}`);
    }
  }
  throw new Error(`[store] no data source answered: ${(err as Error)?.message}`);
}

const RETRY_MS = 30_000;

// Kept on globalThis so dev hot reloads don't re-parse 20 MB each time.
const g = globalThis as unknown as { __meStore?: { cache?: Store; inflight?: Promise<Store>; failedAt?: number; prev?: Store } };
const state = (g.__meStore ??= {});

export function getStore(): Promise<Store> {
  if (state.cache && Date.now() - state.cache.loadedAt < TTL_MS) return Promise.resolve(state.cache);
  if (state.inflight) return state.inflight;
  // While every source is down, serve the last good copy and retry at most every 30 s.
  if (state.cache && state.failedAt && Date.now() - state.failedAt < RETRY_MS) return Promise.resolve(state.cache);
  state.inflight = loadRaw()
    .then((raw) => {
      state.failedAt = undefined;
      const next = buildStore(raw);
      if (state.cache && state.cache.meta.scanned_at !== next.meta.scanned_at) state.prev = state.cache;
      return (state.cache = next);
    })
    .catch((e) => { state.failedAt = Date.now(); throw e; })
    .finally(() => (state.inflight = undefined));
  // A failed refresh keeps serving the previous copy if there is one.
  return state.cache ? state.inflight.catch(() => state.cache!) : state.inflight;
}

/** Free data is DELAY_MIN behind (docs/08): while the newest scan is younger than that, serve the one before.
 *  ponytail: previous scan kept in memory per instance; a fresh instance has none and serves the newest.
 *  Upgrade: have the engine publish a delayed copy (e.g. scan/delayed/) and read that for free users. */
export async function getStoreFor(tier: Tier): Promise<Store> {
  const s = await getStore();
  const cutoff = Date.now() / 1000 - DELAY_MIN[tier] * 60;
  return DELAY_MIN[tier] === 0 || s.meta.scanned_at <= cutoff || !state.prev ? s : state.prev;
}

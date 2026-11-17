// In-memory data store (docs/02 § Data flow): one parsed copy per server instance, 120 s cache,
// concurrent loads de-duplicated. Server only — never ship markets.json to the browser.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DATA_SOURCE, dataDirSetting, github } from "@/lib/config";
import { Flag as FlagSchema, Market as MarketSchema, ScanMeta as MetaSchema } from "@/lib/schemas";
import type { BacktestFile, EventsFile, FlagsFile, LedgerSummary, MarketsFile, ModelFile, ScanMeta, StoreMarket } from "@/lib/types";
import { derive } from "./derive";
import { buildSearch, type SearchIndex } from "./search";

export interface RawData {
  markets: MarketsFile;
  flags: FlagsFile;
  model: ModelFile;
  backtest: BacktestFile;
  events?: EventsFile;              // output/events.json (T-05), optional
  ledgerSummary?: LedgerSummary;    // output/ledger_summary.json (T-04), optional
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
  };
}

async function readSource(file: string): Promise<string | undefined> {
  if (DATA_SOURCE === "github") {
    const { token, repo, ref } = github();
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${file}?ref=${ref}`, {
      headers: { Accept: "application/vnd.github.raw", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: "no-store",
    });
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`[store] GitHub ${file}: HTTP ${res.status}`);
    return res.text();
  }
  try {
    return await readFile(path.join(dataDir(), file), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw e;
  }
}

async function readJson<T>(file: string, required: true): Promise<T>;
async function readJson<T>(file: string, required: false): Promise<T | undefined>;
async function readJson<T>(file: string, required: boolean) {
  const text = await readSource(file);
  if (text === undefined) {
    if (required) throw new Error(`[store] missing ${file} (DATA_SOURCE=${DATA_SOURCE}, dir=${dataDir()})`);
    return undefined;
  }
  return JSON.parse(text) as T;
}

export async function loadRaw(): Promise<RawData> {
  const [markets, flags, model, backtest, events, ledgerSummary] = await Promise.all([
    readJson<MarketsFile>("markets.json", true),
    readJson<FlagsFile>("flags.json", true),
    readJson<ModelFile>("model.json", true),
    readJson<BacktestFile>("backtest.json", true),
    readJson<EventsFile>("events.json", false),
    readJson<LedgerSummary>("ledger_summary.json", false),
  ]);
  return { markets, flags, model, backtest, events, ledgerSummary };
}

// Kept on globalThis so dev hot reloads don't re-parse 20 MB each time.
const g = globalThis as unknown as { __meStore?: { cache?: Store; inflight?: Promise<Store> } };
const state = (g.__meStore ??= {});

export function getStore(): Promise<Store> {
  if (state.cache && Date.now() - state.cache.loadedAt < TTL_MS) return Promise.resolve(state.cache);
  if (state.inflight) return state.inflight;
  state.inflight = loadRaw()
    .then((raw) => (state.cache = buildStore(raw)))
    .finally(() => (state.inflight = undefined));
  // A failed refresh keeps serving the previous copy if there is one.
  return state.cache ? state.inflight.catch(() => state.cache!) : state.inflight;
}

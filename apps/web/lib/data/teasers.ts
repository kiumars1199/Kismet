// Cold first byte of a signed-out /m/<id> (T-hydr3). The page needs a market's title, category, close time and price and
// nothing else, but the full store is ~35 MB parsed and indexed (and, for Free, again for the delay's *-prev copies). The
// engine writes teasers.json after each scan (engine/precompute.py teasers_file; ops/upload.py rotates it to -prev / -prev2
// with the scan, like top.json): {"meta": {"scanned_at"}, "rows": {id: [question, event, category, closes_at, price,
// price_outcome]}}, a few hundred KB gzipped. Missing, malformed or stale, or no row for the id = undefined, and the caller
// falls back to the store. Same Free delay rule as getStoreFor: the newest copy at least the delay old. Server only.
import "server-only";
import { DATA_SOURCE } from "@/lib/config";
import { getSettings } from "@/lib/settings";
import { delayMin } from "@/lib/settings-core";
import { readSource, sourceChain } from "./store";
import { getCounts } from "./top";

/** Small files, re-read often so a fresh upload shows within a minute. */
const TTL_MS = 60_000;
/** A teasers.json this much older than now is from a publisher that stopped writing it (DATA_CLOCK=scan: never). */
const MAX_AGE_S = 3600;

export type TeaserRow = [question: string | null, event: string | null, category: string | null, closes_at: number | null, price: number | null, outcome: string | null];
export interface TeaserFile { meta: { scanned_at: number }; rows: Record<string, TeaserRow> }
/** The parts of a Teaser this file can fill (lib/teaser.ts adds the label and event cleanup, shared with the store path). */
export interface IndexedTeaser { id: string; question: string; event: string; category: string; closes_at: number | null; price: number | null; price_outcome: string | undefined }

type Entry = { at: number; value: TeaserFile | undefined; inflight?: Promise<TeaserFile | undefined> };
const g = globalThis as unknown as { __meTeasers?: Map<string, Entry> };
const cache = (g.__meTeasers ??= new Map());
export const _resetTeaserIndex = () => cache.clear();

const valid = (f: unknown): f is TeaserFile =>
  !!f && typeof f === "object" && typeof (f as TeaserFile).meta?.scanned_at === "number" && !!(f as TeaserFile).rows && typeof (f as TeaserFile).rows === "object";

function load(name: string, fresh = false): Promise<TeaserFile | undefined> {
  const hit = cache.get(name);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.value);
  if (!fresh && hit?.inflight) return hit.inflight;
  const inflight = readSource(name, sourceChain(DATA_SOURCE))
    .then((text) => { const f = text === undefined ? undefined : JSON.parse(text); return valid(f) ? f : undefined; })
    .catch((e) => { console.warn(`[teasers] ${name} unreadable: ${(e as Error).message}`); return undefined; })
    .then((value) => { cache.set(name, { at: Date.now(), value }); return value; });
  cache.set(name, { at: hit?.at ?? 0, value: hit?.value, inflight });
  return inflight;
}

/** The compact row for market `id` from the newest copy Free may see, or undefined (the caller uses the store).
 *  `nowMs`/`liveClock` are for tests: with DATA_CLOCK=scan (fixtures) a file is never "stale". */
export async function indexedMarketTeaser(id: string, nowMs = Date.now(), liveClock = process.env.DATA_CLOCK !== "scan"): Promise<IndexedTeaser | undefined> {
  const [first, counts] = await Promise.all([load("teasers.json"), getCounts(), getSettings()]);   // getSettings: the Free delay
  let newest = first;
  if (!newest) return undefined;
  // The publisher never deletes bucket objects: when a scan's precompute failed for this file only, the previous scan's
  // teasers.json stays next to the new counts.json. A copy older than the counts of the same newest scan is that leftover
  // (its -prev copies are older still): use the store instead. But after a NORMAL scan the same is true of a copy cached before
  // it (counts' cache expires after 30 s, this one after 60 s): read the file once more, bypassing the cache, and only then give
  // up. No counts file = nothing to compare with.
  if (counts && newest.meta.scanned_at < counts.scanned_at) {
    newest = await load("teasers.json", true);
    if (!newest || newest.meta.scanned_at < counts.scanned_at) return undefined;
  }
  if (liveClock && nowMs / 1000 - newest.meta.scanned_at > MAX_AGE_S) return undefined;
  const cutoff = nowMs / 1000 - delayMin("free") * 60;
  let file = newest.meta.scanned_at <= cutoff ? newest : undefined;
  if (!file) {
    const [prev, prev2] = await Promise.all([load("teasers-prev.json"), load("teasers-prev2.json")]);
    file = [prev, prev2].filter((c): c is TeaserFile => !!c && c.meta.scanned_at <= cutoff).sort((a, b) => b.meta.scanned_at - a.meta.scanned_at)[0];
  }
  const row = file?.rows[id];
  if (!Array.isArray(row) || typeof row[0] !== "string") return undefined;
  return { id, question: row[0], event: typeof row[1] === "string" ? row[1] : "", category: typeof row[2] === "string" ? row[2] : "", closes_at: typeof row[3] === "number" ? row[3] : null,
    price: typeof row[4] === "number" ? row[4] : null, price_outcome: typeof row[5] === "string" ? row[5] : undefined };
}

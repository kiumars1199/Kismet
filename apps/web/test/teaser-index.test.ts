// Cold first byte of /m/<id> (T-hydr3): a signed-out market page needs only title, category, close time and price. It used to
// load the whole store (markets + flags + model + backtest + ledger, then the Free delay's *-prev copies, ~35 MB parsed and
// indexed up to three times) on a cold instance. engine/precompute.py now writes teasers.json (+ -prev / -prev2 via the
// publisher) with one compact row per market; marketTeaser reads that, and falls back to the store when it can't.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Market } from "@/lib/types";

const h = vi.hoisted(() => ({ files: new Map<string, string>(), reads: [] as string[], storeCalls: 0 }));
vi.mock("@/lib/data/store", async (orig) => {
  const real = await orig<typeof import("@/lib/data/store")>();
  return {
    ...real,
    readSource: async (file: string) => { h.reads.push(file); return h.files.get(file); },
    getStoreFor: async (...a: Parameters<typeof real.getStoreFor>) => { h.storeCalls++; return real.getStoreFor(...a); },
  };
});

const { getStoreFor } = await import("@/lib/data/store");
const { marketTeaser } = await import("@/lib/teaser");
const { indexedMarketTeaser, _resetTeaserIndex } = await import("@/lib/data/teasers");

/** The documented row shape (engine/precompute.py teasers_file): [question, event, category, closes_at, price, price_outcome]. */
const compact = (m: Market) => [m.question, m.event, m.category, m.closes_at ?? null, typeof m.sides?.[0]?.mid === "number" ? m.sides[0].mid : null, m.sides?.[0]?.outcome ?? null];
const file = (at: number, ms: Market[]) => JSON.stringify({ meta: { scanned_at: at }, rows: Object.fromEntries(ms.map((m) => [m.id, compact(m)])) });
const NOW = 1_800_000_000;   // seconds; Free is 15 min behind: a copy at or before NOW - 900 is eligible

beforeEach(() => { h.files.clear(); h.reads.length = 0; h.storeCalls = 0; _resetTeaserIndex(); });

describe("marketTeaser reads teasers.json first", () => {
  it("gives the same Teaser as the full store for every fixture market, without touching the store", async () => {
    const store = await getStoreFor("free");
    h.storeCalls = 0;
    const ms = store.markets.slice(0, 40);
    for (const m of ms) {
      h.files.set("teasers.json", file(Date.now() / 1000 - 1800, ms)); _resetTeaserIndex();
      h.storeCalls = 0;
      const viaIndex = await marketTeaser(m.id);
      expect(h.storeCalls).toBe(0);
      h.files.delete("teasers.json"); _resetTeaserIndex();
      const viaStore = await marketTeaser(m.id);   // index gone: the store answers
      expect(viaIndex, m.id).toEqual(viaStore);
    }
  });

  it("marketTeaser answers from the index and the store is never asked", async () => {
    const store = await getStoreFor("free");
    const m = store.markets[0]!;
    h.storeCalls = 0;
    h.files.set("teasers.json", file(Date.now() / 1000 - 3600, [m]));
    const t = await marketTeaser(m.id);
    expect(t?.id).toBe(m.id);
    expect(t?.title).toBe(m.question);
    expect(h.storeCalls).toBe(0);
  });

  it("holds the Free delay: a scan younger than the delay is skipped for -prev, and none old enough means no answer", async () => {
    const store = await getStoreFor("free");
    const [a, b] = store.markets as unknown as [Market, Market];
    const young = { ...a, sides: [{ ...a.sides[0]!, mid: 0.9 }, ...a.sides.slice(1)] } as Market;
    h.files.set("teasers.json", file(NOW - 300, [young]));          // 5 min old: too young for Free
    h.files.set("teasers-prev.json", file(NOW - 1500, [a, b]));      // 25 min old: eligible
    const t = await indexedMarketTeaser(a.id, NOW * 1000);
    expect(t?.price).toBe(a.sides[0]!.mid);                           // the older copy's price, not 0.9
    h.files.delete("teasers-prev.json"); _resetTeaserIndex();
    expect(await indexedMarketTeaser(a.id, NOW * 1000)).toBeUndefined();   // nothing old enough: the caller falls back
  });

  it("falls back (undefined) for a missing file, a malformed one, an id the scan does not have, and a file a publisher stopped writing", async () => {
    const store = await getStoreFor("free");
    const m = store.markets[0]!;
    expect(await indexedMarketTeaser(m.id, NOW * 1000)).toBeUndefined();   // no file
    h.files.set("teasers.json", "{broken"); _resetTeaserIndex();
    expect(await indexedMarketTeaser(m.id, NOW * 1000)).toBeUndefined();
    h.files.set("teasers.json", file(NOW - 1800, [store.markets[1]!])); _resetTeaserIndex();
    expect(await indexedMarketTeaser(m.id, NOW * 1000)).toBeUndefined();   // id not in this scan
    h.files.set("teasers.json", file(NOW - 1800, [m])); _resetTeaserIndex();
    expect(await indexedMarketTeaser(m.id, (NOW + 4 * 3600) * 1000, true)).toBeUndefined();   // 4 h old with the clock live: stale
  });

  it("an unknown id still reaches the store (so a real 404 is decided there)", async () => {
    h.files.set("teasers.json", file(Date.now() / 1000 - 3600, []));
    expect(await marketTeaser("no-such-market")).toBeNull();
    expect(h.storeCalls).toBeGreaterThan(0);
  });
});

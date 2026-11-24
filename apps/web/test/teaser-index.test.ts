// Cold first byte of /m/<id> (T-hydr3): a signed-out market page needs only title, category, close time and price. It used to
// load the whole store (markets + flags + model + backtest + ledger, then the Free delay's *-prev copies, ~35 MB parsed and
// indexed up to three times) on a cold instance. engine/precompute.py now writes teasers.json (+ -prev / -prev2 via the
// publisher) with one compact row per market; marketTeaser reads that, and falls back to the store when it can't.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Market } from "@/lib/types";

const h = vi.hoisted(() => ({ files: new Map<string, string>(), reads: [] as string[], storeCalls: 0, log: [] as string[], delayMs: 0 }));
vi.mock("@/lib/data/store", async (orig) => {
  const real = await orig<typeof import("@/lib/data/store")>();
  return {
    ...real,
    readSource: async (file: string) => {
      h.reads.push(file); h.log.push(`start ${file}`);
      if (h.delayMs) await new Promise((ok) => setTimeout(ok, h.delayMs));
      h.log.push(`end ${file}`);
      return h.files.get(file);
    },
    getStoreFor: async (...a: Parameters<typeof real.getStoreFor>) => { h.storeCalls++; return real.getStoreFor(...a); },
  };
});

const { getStoreFor } = await import("@/lib/data/store");
const { marketTeaser } = await import("@/lib/teaser");
const { indexedMarketTeaser, _resetTeaserIndex } = await import("@/lib/data/teasers");
const { resetTop, getTopStore, getCounts } = await import("@/lib/data/top");
import { readFileSync } from "node:fs";

/** The documented row shape (engine/precompute.py teasers_file): [question, event, category, closes_at, price, price_outcome]. */
const compact = (m: Market) => [m.question, m.event, m.category, m.closes_at ?? null, typeof m.sides?.[0]?.mid === "number" ? m.sides[0].mid : null, m.sides?.[0]?.outcome ?? null];
const file = (at: number, ms: Market[]) => JSON.stringify({ meta: { scanned_at: at }, rows: Object.fromEntries(ms.map((m) => [m.id, compact(m)])) });
const NOW = 1_800_000_000;   // seconds; Free is 15 min behind: a copy at or before NOW - 900 is eligible

beforeEach(() => { h.files.clear(); h.reads.length = 0; h.log.length = 0; h.delayMs = 0; h.storeCalls = 0; vi.useRealTimers(); _resetTeaserIndex(); resetTop(); });

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

  it("a teasers.json older than the scan's counts.json (a failed precompute left it in the bucket) is ignored; a matching pair is used", async () => {
    const store = await getStoreFor("free");
    const m = store.markets[0]!;
    const counts = (at: number) => h.files.set("counts.json", JSON.stringify({ scanned_at: at, meta: { scanned_at: at }, best_bets: { total: 0, sections: {}, by_category: {} } }));
    h.files.set("teasers.json", file(NOW - 1800, [m]));
    counts(NOW - 300);                                             // the newest scan wrote counts.json but not teasers.json
    expect(await indexedMarketTeaser(m.id, NOW * 1000)).toBeUndefined();
    h.files.set("teasers-prev.json", file(NOW - 3000, [m])); _resetTeaserIndex(); resetTop();
    expect(await indexedMarketTeaser(m.id, NOW * 1000)).toBeUndefined();   // its prev copies are older still: also not used
    counts(NOW - 1800); _resetTeaserIndex(); resetTop();           // same scan: used
    expect((await indexedMarketTeaser(m.id, NOW * 1000))?.id).toBe(m.id);
    h.files.delete("counts.json"); _resetTeaserIndex(); resetTop(); // no counts file to compare with: used, as before
    expect((await indexedMarketTeaser(m.id, NOW * 1000))?.id).toBe(m.id);
  });

  it("through marketTeaser: the stale teasers file sends the request to the store", async () => {
    const store = await getStoreFor("free");
    const m = store.markets[0]!;
    h.files.set("teasers.json", file(Date.now() / 1000 - 1800, [{ ...m, question: "STALE TITLE" } as Market]));
    h.files.set("counts.json", JSON.stringify({ scanned_at: Date.now() / 1000 - 300, meta: { scanned_at: Date.now() / 1000 - 300 }, best_bets: { total: 0, sections: {}, by_category: {} } }));
    h.storeCalls = 0;
    const t = await marketTeaser(m.id);
    expect(t?.title).toBe(m.question);       // the store's title, not the stale file's
    expect(h.storeCalls).toBeGreaterThan(0);
  });
});

// T-hydr4 review: after a NORMAL scan the new counts.json, teasers.json and top.json share a scanned_at, but the caches expire on their
// own clocks (counts 30 s, teasers 60 s): for up to a minute counts is new while the cached teasers (or top) is old. That is not a leftover:
// the stale-guard must re-read the older file once, bypassing the cache, before it gives the page to the 35 MB store.
const countsFile = (at: number) => JSON.stringify({ scanned_at: at, meta: { scanned_at: at }, best_bets: { total: 0, sections: {}, by_category: {} } });

describe("the stale-guard with caches out of step (a normal scan)", () => {
  it("counts new, teasers cached old: the teasers file is re-read once and the teaser path is kept (the store is never loaded)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.now();
    const store = await getStoreFor("free");
    const m = store.markets[0]!;
    h.files.set("teasers.json", file(NOW - 1800, [{ ...m, question: "OLD TITLE" } as Market]));
    h.files.set("counts.json", countsFile(NOW - 1800));
    expect((await indexedMarketTeaser(m.id, NOW * 1000))?.question).toBe("OLD TITLE");   // both cached, same scan
    // a normal scan: the three files are uploaded with the new scanned_at ...
    h.files.set("teasers.json", file(NOW - 900, [{ ...m, question: "NEW TITLE" } as Market]));
    h.files.set("counts.json", countsFile(NOW - 900));
    // ... and 35 s later counts' 30 s cache has expired but teasers' 60 s one has not
    vi.setSystemTime(start + 35_000);
    h.storeCalls = 0; h.reads.length = 0;
    const t = await indexedMarketTeaser(m.id, (NOW + 35) * 1000);
    expect(t?.question, "the new copy, not undefined (the store) and not the old one").toBe("NEW TITLE");
    expect(h.reads.filter((r) => r === "teasers.json")).toHaveLength(1);   // re-read once
    expect(h.storeCalls).toBe(0);
  });

  it("a real leftover is still refused: counts is newer than teasers.json even after the re-read", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.now();
    const store = await getStoreFor("free");
    const m = store.markets[0]!;
    h.files.set("teasers.json", file(NOW - 1800, [m]));
    h.files.set("counts.json", countsFile(NOW - 1800));
    await indexedMarketTeaser(m.id, NOW * 1000);
    h.files.set("counts.json", countsFile(NOW - 900));   // the new scan wrote counts, its teasers upload failed
    vi.setSystemTime(start + 35_000);
    expect(await indexedMarketTeaser(m.id, (NOW + 35) * 1000)).toBeUndefined();
  });

  it("resetTop() (the revalidate route) also clears the teaser cache", async () => {
    const store = await getStoreFor("free");
    const m = store.markets[0]!;
    h.files.set("teasers.json", file(NOW - 1800, [{ ...m, question: "OLD TITLE" } as Market]));
    expect((await indexedMarketTeaser(m.id, NOW * 1000))?.question).toBe("OLD TITLE");
    h.files.set("teasers.json", file(NOW - 1800, [{ ...m, question: "NEW TITLE" } as Market]));
    expect((await indexedMarketTeaser(m.id, NOW * 1000))?.question).toBe("OLD TITLE");   // still cached
    resetTop();
    expect((await indexedMarketTeaser(m.id, NOW * 1000))?.question).toBe("NEW TITLE");
  });

  it("top.json: counts new, top cached old: re-read once, the top store is served (not undefined)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.now();
    const top = JSON.parse(readFileSync("test/fixtures/top.json", "utf8")) as { meta: { scanned_at: number } };
    const at = top.meta.scanned_at;
    const withAt = (t: number) => JSON.stringify({ ...top, meta: { ...top.meta, scanned_at: t } });
    h.files.set("top.json", withAt(at)); h.files.set("counts.json", countsFile(at));
    await getCounts();                                   // counts cached at t0 ...
    vi.setSystemTime(start + 20_000);
    expect(await getTopStore("pro")).toBeDefined();      // ... top.json cached at t0 + 20 s
    h.files.set("top.json", withAt(at + 120)); h.files.set("counts.json", countsFile(at + 120));   // a normal scan
    vi.setSystemTime(start + 35_000);                    // counts' 30 s cache has expired, top.json's has not
    h.reads.length = 0;
    expect(await getTopStore("pro"), "the new top.json, not the full store").toBeDefined();
    expect(h.reads.filter((r) => r === "top.json")).toHaveLength(1);
  });

  it("top.ts reads top.json and counts.json together (one round trip on a cold instance)", async () => {
    const top = readFileSync("test/fixtures/top.json", "utf8");
    const at = (JSON.parse(top) as { meta: { scanned_at: number } }).meta.scanned_at;
    h.files.set("top.json", top); h.files.set("counts.json", countsFile(at));
    h.delayMs = 40;
    await getTopStore("pro");
    expect(h.log.indexOf("start counts.json"), `reads: ${h.log.join(", ")}`).toBeLessThan(h.log.indexOf("end top.json"));
  });
});

// Egress fix (Nov 27): bytes one server instance downloads from Supabase Storage in an hour, before vs after version.json.
// A fake bucket holds the files gzipped (as ops/upload.py stores them) plus version.json; a new scan lands every 15 min and
// the model changes once (the hourly fit). Requests come every 10 s and hit the store, the small results files (top.ts,
// 30 s cache), top.json and a category (30 s), one teaser (60 s) and history.json (120 s), like a busy instance. Bytes counted = gzipped bodies returned by Storage.
// EGRESS_DIR=<dir> runs it on a full-size scan (output/ plus engine precompute's top/counts/teasers files) and prints
// the numbers for the PR. EGRESS_BASELINE=1 skips the assertions, to measure the code from before the fix.
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

const DIR = path.resolve(process.env.EGRESS_DIR ?? "test/fixtures");
const FILES = ["markets.json", "flags.json", "model.json", "backtest.json", "counts.json", "top.json", "top-sports.json", "teasers.json", "history.json"].filter((f) => readdirSync(DIR).includes(f));
const plain = Object.fromEntries(FILES.map((f) => [f, readFileSync(path.join(DIR, f), "utf8")]));
const scanned0 = (JSON.parse(plain["flags.json"]!) as { meta: { scanned_at: number } }).meta.scanned_at;

const bucket = new Map<string, Buffer>();
const bytes = new Map<string, number>();
/** Same as ops/upload.py digest() and store.ts hashOf (kept local so the harness also runs against the old store). */
const hashOf = (b: Uint8Array) => createHash("sha256").update(b).digest("hex").slice(0, 16);

/** What ops/upload.py does: every file gzipped, then version.json with each file's plain hash, last. */
function publish(scan: number, fit: number) {
  const files: Record<string, string> = {};
  for (const f of FILES) {
    let text = plain[f]!;
    if (["markets.json", "flags.json", "counts.json", "top.json", "top-sports.json", "teasers.json"].includes(f)) text = text.replace(String(scanned0), String(scanned0 + scan * 900));
    if (f === "model.json") text = text.replace(/^\{/, `{"_fit":${fit},`);
    if (f === "history.json") text = text.replace(/^\{/, `{"_scan":${scan},`);
    const body = Buffer.from(text);
    bucket.set(f, gzipSync(body));
    files[f] = hashOf(body);
  }
  bucket.set("version.json", gzipSync(Buffer.from(JSON.stringify({ scanned_at: scanned0 + scan * 900, files }))));
}

beforeAll(() => {
  Object.assign(process.env, { DATA_SOURCE: "supabase", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "svc" });
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(scanned0 * 1000);
  vi.stubGlobal("fetch", async (url: string) => {
    const name = String(url).split("/").pop()!;
    const body = bucket.get(name);
    if (!body) return new Response("missing", { status: 400 });
    bytes.set(name, (bytes.get(name) ?? 0) + body.length);
    return new Response(new Uint8Array(body));
  });
});
afterAll(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test("one instance downloads at least 10x fewer bytes per hour", async () => {
  const store = await import("@/lib/data/store");
  const { getResults, getTopStore } = await import("@/lib/data/top");
  const { indexedMarketTeaser } = await import("@/lib/data/teasers");
  const teaserId = plain["teasers.json"] && Object.keys((JSON.parse(plain["teasers.json"]) as { rows: object }).rows)[0];
  const { getHistory } = await import("@/lib/data/history");
  const g = globalThis as unknown as { __meStore: { inflight?: Promise<unknown> } };
  store._resetStore();
  publish(0, 0);
  const HOUR_S = 3600, TICK_S = 10;
  for (let t = 0; t < HOUR_S; t += TICK_S) {
    vi.setSystemTime((scanned0 + t) * 1000);
    if (t > 0 && t % 900 === 0) publish(t / 900, t >= 1800 ? 1 : 0);   // a scan every 15 min; the hourly fit at :30
    await store.getStore();
    while (g.__meStore.inflight) await g.__meStore.inflight.catch(() => {});
    await getResults();
    await getHistory();
    await getTopStore("pro");
    await getTopStore("pro", "sports");
    if (teaserId) await indexedMarketTeaser(teaserId);
  }
  const total = [...bytes.values()].reduce((a, b) => a + b, 0);
  const rows = [...bytes.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${(n / 1e6).toFixed(2)} MB`);
  console.log(`[egress] ${DIR}: ${(total / 1e6).toFixed(2)} MB/h per instance\n  ${rows.join("\n  ")}`);
  const s = await store.getStore();
  expect(s.meta.scanned_at).toBe(scanned0 + 3 * 900);   // still serves the newest scan
  if (process.env.EGRESS_BASELINE) return;   // measuring the old code: no assertion
  // Per hour: 4 scans x the changed files, plus about 240 version.json checks. The old code downloaded all of it every 30-120 s.
  const per = (f: string) => bucket.get(f)?.length ?? 0;
  const once = FILES.reduce((a, f) => a + per(f), 0);
  expect(total).toBeLessThan((4 * once + 240 * per("version.json")) * 1.05);
  // An unchanged file is downloaded again only after TRUST_MS (30 min), the safety net for a manifest that missed an update.
  expect(bytes.get("backtest.json")).toBeLessThanOrEqual(2 * per("backtest.json"));    // never changed: 2 downloads, not 120
  expect(bytes.get("model.json")).toBeLessThanOrEqual(3 * per("model.json") + 64);     // + the fit at :30
}, 120_000);

test("no version.json (an older publisher): every reload downloads, as before", async () => {
  const store = await import("@/lib/data/store");
  const g = globalThis as unknown as { __meStore: { inflight?: Promise<unknown> } };
  store._resetStore();
  publish(0, 0);
  bucket.delete("version.json");
  bytes.clear();
  for (let t = 0; t < 600; t += 10) {   // 10 min, 120 s cache: the first load and 4 reloads
    vi.setSystemTime((scanned0 + 7200 + t) * 1000);
    await store.getStore();
    while (g.__meStore.inflight) await g.__meStore.inflight.catch(() => {});
  }
  expect(bytes.get("markets.json")).toBe(5 * bucket.get("markets.json")!.length);
}, 60_000);

test("a new model under the same scan is picked up once, then the store stops downloading", async () => {
  const store = await import("@/lib/data/store");
  const g = globalThis as unknown as { __meStore: { inflight?: Promise<unknown> } };
  store._resetStore();
  const settle = async (t: number) => {
    vi.setSystemTime((scanned0 + 10_000 + t) * 1000);
    await store.getStore();
    while (g.__meStore.inflight) await g.__meStore.inflight.catch(() => {});
    return store.getStore();
  };
  publish(0, 0);
  await settle(0);
  publish(0, 7);   // same scan, new fit
  bytes.clear();
  const s = await settle(130);
  expect((s.model as unknown as { _fit: number })._fit).toBe(7);
  expect(bytes.get("markets.json")).toBe(bucket.get("markets.json")!.length);   // one reload
  bytes.clear();
  for (let t = 260; t < 900; t += 130) await settle(t);
  expect([...bytes.keys()]).toEqual(["version.json"]);   // nothing else since
}, 60_000);

// F14: history for markets the engine file does not hold (live CLOB fallback), downsampling, and the tier delay cut.
import { copyFileSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downsample } from "@/lib/history/downsample";

const h = vi.hoisted(() => ({ tier: "premium" as string }));
vi.mock("@/lib/auth/server", () => ({ getMe: async () => ({ user: { id: "u1", email: "u@x.test" }, tier: h.tier, beta: false }) }));

const NOW = 1_800_000_000;
const raw = (n: number, step = 600, start = NOW - 20 * 86400) => Array.from({ length: n }, (_, i) => ({ t: start + i * step, p: 0.3 + (i % 50) / 100 }));

describe("downsample (twin of engine/history.py)", () => {
  it("at most 200 points, at most 90 days, whole-hour step, first and last price exact", () => {
    const s = downsample(raw(5000, 600, NOW - 80 * 86400), NOW, 0)!;
    expect(s.p.length).toBeLessThanOrEqual(200);
    expect(s.dt % 3600).toBe(0);
    expect(s.p[0]).toBe(Math.round(0.3 * 1000));
    const old = downsample([{ t: NOW - 100 * 86400, p: 0.5 }, { t: NOW - 1000, p: 0.6 }, { t: NOW - 500, p: 0.7 }], NOW, 1)!;
    expect(old.t0).toBe(NOW - 1000);   // the 100-day-old point is dropped
    expect(old.side).toBe(1);
  });
  it("nothing usable = null; out-of-range prices and future points are dropped", () => {
    expect(downsample([], NOW, 0)).toBeNull();
    expect(downsample([{ t: NOW + 10, p: 0.5 }, { t: NOW - 10, p: 1.5 }], NOW, 0)).toBeNull();
  });
});

const clobBody = (n = 700) => ({ history: raw(n, 3600, Math.floor(Date.now() / 1000) - n * 3600 + 3600) });

describe("/api/markets/[id]/history with a live fallback", () => {
  const calls: string[] = [];
  beforeEach(() => { calls.length = 0; });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); h.tier = "premium"; });

  const call = async (id: string, env: Record<string, string> = {}) => {
    vi.resetModules();
    vi.stubEnv("DATA_CLOCK", "scan");
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    const { GET } = await import("@/app/api/markets/[id]/history/route");
    return GET(new Request(`http://test/api/markets/${id}/history`), { params: Promise.resolve({ id }) });
  };
  const stubClob = (impl: (url: string) => Response | Promise<Response>) =>
    vi.stubGlobal("fetch", vi.fn(async (u: string | URL) => { calls.push(String(u)); return impl(String(u)); }));

  it("a market with no engine series is fetched live from the CLOB, cut at the scan, downsampled, labelled live", async () => {
    stubClob(() => Response.json(clobBody()));
    const res = await call("7078474");
    const b = (await res.json()) as { points: { t: number; p: number }[]; source: string; as_of: number; interval_s: number };
    expect(calls.length).toBe(1);
    expect(calls[0]).toMatch(/^https:\/\/clob\.polymarket\.com\/prices-history\?market=\d+&fidelity=60&interval=max/);
    expect(b.source).toBe("live");
    expect(b.points.length).toBeGreaterThan(10);
    expect(b.points.length).toBeLessThanOrEqual(200);
    expect(b.points.at(-1)!.t).toBe(b.as_of);
    expect(b.interval_s % 3600).toBe(0);
  });

  it("the tier's delay: no point is newer than the store's scan (fixture scan 1794873437)", async () => {
    stubClob(() => Response.json({ history: raw(700, 3600, 1794873437 - 300 * 3600) }));   // runs to ~1794873437 + 400 h
    h.tier = "free";
    const b = (await (await call("7078474")).json()) as { points: { t: number }[] };
    expect(b.points.length).toBeGreaterThan(5);
    expect(Math.max(...b.points.map((x) => x.t))).toBeLessThanOrEqual(1794873437);
  });

  it("a failed or timed-out fetch is an empty series, not an error; no history, no source", async () => {
    stubClob(() => { throw new DOMException("timed out", "TimeoutError"); });
    const res = await call("7078474");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ points: [], source: null, as_of: null, interval_s: null });
  });

  it("an empty interval=max answer falls back to the last 14 days; a market the engine file holds makes no CLOB call", async () => {
    stubClob((u) => Response.json(u.includes("interval=max") ? { history: [] } : clobBody(300)));
    const b = (await (await call("7078474")).json()) as { points: unknown[] };
    expect(calls.length).toBe(2);
    expect(calls[1]).toMatch(/startTs=\d+&endTs=\d+/);
    expect(b.points.length).toBeGreaterThan(5);
    calls.length = 0;
    await call("6674492");
    expect(calls.length).toBe(0);
  });

  it("an unknown market is 404 with no CLOB call", async () => {
    stubClob(() => Response.json(clobBody()));
    expect((await call("nope")).status).toBe(404);
    expect(calls.length).toBe(0);
  });

  it("an engine series for the other side is not used: the live fetch runs for the market's best side", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "hist-"));
    for (const f of readdirSync(path.join(__dirname, "fixtures"))) if (f.endsWith(".json")) copyFileSync(path.join(__dirname, "fixtures", f), path.join(dir, f));
    const hist = JSON.parse((await import("node:fs")).readFileSync(path.join(dir, "history.json"), "utf8"));
    hist.series["6674492"].side = 1;   // the market's best side is 0
    writeFileSync(path.join(dir, "history.json"), JSON.stringify(hist));
    stubClob(() => Response.json(clobBody()));
    const b = (await (await call("6674492", { DATA_DIR: dir, DATA_SOURCE: "local" })).json()) as { source: string };
    expect(calls.length).toBe(1);
    expect(b.source).toBe("live");
  });
});

describe("liveHistory cache", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("one request in flight per market, a 10-minute cache, and no token = null without a call", async () => {
    vi.resetModules();
    const { liveHistory, _resetForTests } = await import("@/lib/data/history-live");
    _resetForTests();
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => { n++; await new Promise((r) => setTimeout(r, 20)); return Response.json(clobBody()); }));
    const [a, b] = await Promise.all([liveHistory("tok", 0), liveHistory("tok", 0)]);
    expect(n).toBe(1);
    expect(a).toBe(b);
    await liveHistory("tok", 0);
    expect(n).toBe(1);   // cached
    expect(await liveHistory(undefined, 0)).toBeNull();
    expect(n).toBe(1);
  });
});

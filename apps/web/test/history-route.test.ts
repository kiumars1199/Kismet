// F14: GET /api/markets/<id>/history, gated like /api/markets/[id]; a missing history.json is an empty series, never an error.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Tier } from "@/lib/entitlements";
import { parseHistory } from "@/lib/data/history";

const h = vi.hoisted(() => ({ tier: "premium" as Tier }));
vi.mock("@/lib/auth/server", () => ({ getMe: async () => ({ user: { id: "u1", email: "u@x.test" }, tier: h.tier, beta: false }) }));

type Body = { id: string; side: 0 | 1 | null; interval_s: number | null; venue: string; points: { t: number; p: number }[] };
const call = async (id: string) => {
  vi.resetModules();   // fresh 120 s cache
  const { GET } = await import("@/app/api/markets/[id]/history/route");
  return GET(new Request(`http://test/api/markets/${id}/history`), { params: Promise.resolve({ id }) });
};

describe("/api/markets/[id]/history", () => {
  afterEach(() => { vi.unstubAllEnvs(); h.tier = "premium"; });

  it("a market with a series: points as { t, p } (0..1), the side, the interval and the venue", async () => {
    const res = await call("6674492");
    expect(res.status).toBe(200);
    const b = (await res.json()) as Body;
    expect(b).toMatchObject({ id: "6674492", venue: "Polymarket", interval_s: 39600 });
    expect(b.side === 0 || b.side === 1).toBe(true);
    expect(b.points.length).toBeGreaterThan(10);
    expect(b.points.length).toBeLessThanOrEqual(200);
    expect(b.points.every((x) => x.p >= 0 && x.p <= 1)).toBe(true);
    expect(b.points.map((x) => x.t)).toEqual([...b.points.map((x) => x.t)].sort((a, c) => a - c));
  });

  it("a known market with no history: 200 and an empty series (the chart's empty state)", async () => {
    const res = await call("7078474");
    expect(res.status).toBe(200);
    expect(((await res.json()) as Body).points).toEqual([]);
  });

  it("an unknown market is 404, like /api/markets/[id]", async () => {
    expect((await call("nope")).status).toBe(404);
  });

  it("Free sees the same series for a market it can see (no reveal is spent)", async () => {
    h.tier = "free";
    const res = await call("6674492");
    expect(res.status).toBe(200);
    expect(((await res.json()) as Body).points.length).toBeGreaterThan(10);
  });

  it("the body is never shared-cached (tier-shaped routes are private)", async () => {
    const res = await call("6674492");
    expect(res.headers.get("cache-control")).toMatch(/private|no-store/);
  });

  it("parseHistory: a missing, malformed or wrong-shape file is undefined (= no history), never a throw", () => {
    expect(parseHistory(undefined)).toBeUndefined();
    expect(parseHistory("{not json")).toBeUndefined();
    expect(parseHistory(JSON.stringify({ meta: {} }))).toBeUndefined();
    const ok = parseHistory(JSON.stringify({ meta: { interval_s: 3600 }, series: { a: { side: 0, t0: 1, dt: 3600, p: [500] } } }));
    expect(ok!.series.a!.p).toEqual([500]);
  });
});

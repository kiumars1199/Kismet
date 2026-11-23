// F1: checker numbers equal the card's (betQuote), a price edit recomputes locally, the server body is the same for
// every account, and the Free daily counter is per UTC day and per user.
import { describe, expect, it, beforeEach } from "vitest";
import { betQuote } from "@/lib/betFigures";
import { baseOf, compute } from "@/lib/check/compute";
import { buildCheck } from "@/lib/check/response";
import { checkKey, countCheck, deviceOf } from "@/lib/check/limit";
import { isOpen, isOpenIn } from "@/lib/check/open";
import { memoryLimiter, setLimiter } from "@/lib/abuse";
import type { StoreMarket } from "@/lib/types";
import fixture from "./fixtures/markets.json";

const markets = (fixture as unknown as { markets: StoreMarket[] }).markets;

describe("checker = card", () => {
  for (const m of markets.filter((x) => x.sides.length === 2).slice(0, 5)) {
    for (const s of m.sides) {
      it(`${m.id} side ${s.side_index}: chance, multiplier, edge match betQuote at the card's price`, () => {
        const q = betQuote(m, s);
        const r = compute(baseOf(m, s), q.ask!, 100);
        expect(r.chance).toBe(s.win_prob);
        expect(r.multiplier).toBeCloseTo(q.pays!, 9);
        expect(r.edge).toBeCloseTo(q.edge!, 9);
        expect(r.marketPct).toBe(q.ask);
      });
    }
  }
});

describe("compute", () => {
  const m = markets.find((x) => x.sides.length === 2 && x.sides[0]!.win_prob > 0)!;
  const base = baseOf(m, m.sides[0]!);
  it("price 60% → 50%: multiplier and edge go up, no network involved", () => {
    const a = compute(base, 0.6, 100), b = compute(base, 0.5, 100);
    expect(b.multiplier!).toBeGreaterThan(a.multiplier!);
    expect(b.edge!).toBeGreaterThan(a.edge!);
  });
  it("rejects a price under 1% or over 99% (0.5%, 0%, 99.5%, 100%) and accepts 1% and 99%", () => {
    for (const p of [0.005, 0, 0.995, 1]) expect(compute(base, p, 100).error, String(p)).toBe("price_range");
    for (const p of [0.01, 0.99]) expect(compute(base, p, 100).error, String(p)).toBeNull();
  });
  it("gap = our chance − price, the points the card and drawer show", () => {
    expect(compute(base, 0.5, 100).gap).toBeCloseTo(base.winProb! - 0.5, 12);
  });
  it("rejects 0%, 100%, and stakes outside $1–$100,000", () => {
    expect(compute(base, 0, 100).error).toBe("price_range");
    expect(compute(base, 1, 100).error).toBe("price_range");
    expect(compute(base, 0.5, 0.5).error).toBe("stake_range");
    expect(compute(base, 0.5, 100_001).error).toBe("stake_range");
  });
  it("a side the model can't price gets no score", () => {
    const r = compute({ ...base, winProb: null }, 0.5, 100);
    expect(r.error).toBe("no_model");
    expect(r.score).toBeNull();
  });
  it("our chance under the price scores under 50", () => {
    expect(compute({ ...base, winProb: 0.3, n: 400 }, 0.6, 100).score!).toBeLessThan(50);
  });
});

describe("two accounts, same inputs, byte-identical body", () => {
  it("buildCheck has no caller input", () => {
    const m = markets[0]!;
    const a = JSON.stringify(buildCheck(m, 0, 0.5, 100));
    const b = JSON.stringify(buildCheck(m, 0, 0.5, 100));
    expect(a).toBe(b);
    expect(a).not.toMatch(/user|email|tier/i);
  });
});

describe("Free daily counter", () => {
  beforeEach(() => setLimiter(memoryLimiter()));
  const req = new Request("http://x/api/check");
  const day = (iso: string) => Date.parse(iso);
  it("key is per UTC day and per user, and never holds the raw IP", () => {
    const t = day("2026-11-22T23:59:00Z");
    expect(checkKey("u1", "1.2.3.4", t)).toBe("check:u:u1:2026-11-22");
    expect(checkKey("u1", "1.2.3.4", t)).not.toBe(checkKey("u2", "1.2.3.4", t));
    expect(checkKey("u1", "1.2.3.4", t)).not.toBe(checkKey("u1", "1.2.3.4", t + 120_000));
    expect(checkKey(null, "1.2.3.4", t)).not.toContain("1.2.3.4");
    expect(checkKey(null, "1.2.3.4", t)).not.toBe(checkKey(null, "5.6.7.8", t));
  });
  it("Free: the first check is ok, a second market the same day is refused, the next day resets, another user is separate", async () => {
    const t = day("2026-11-22T10:00:00Z");
    expect((await countCheck(req, "free", "u1", "a", 0, t)).ok).toBe(true);
    expect((await countCheck(req, "free", "u1", "a", 0, t)).ok).toBe(true);   // same bet again: free
    expect((await countCheck(req, "free", "u1", "b", 0, t)).ok).toBe(false);
    expect((await countCheck(req, "free", "u2", "b", 0, t)).ok).toBe(true);
    expect((await countCheck(req, "free", "u1", "b", 0, day("2026-11-23T00:01:00Z"))).ok).toBe(true);
  });
  it("Pro and Premium are never counted", async () => {
    for (let i = 0; i < 20; i++) {
      expect((await countCheck(req, "pro", "u1", `m${i}`, 0)).ok).toBe(true);
      expect((await countCheck(req, "premium", "u3", `m${i}`, 1)).ok).toBe(true);
    }
  });
});

describe("closed markets get no check", () => {
  const closed = markets.find((x) => x.id === "6674492")!;   // closes_at 1794944700 (reviewer's repro: Denmark vs. Norway)
  it("closes_at ≤ now is not open (same rule as the lists' openOnly)", () => {
    expect(isOpen(closed, 1795375691)).toBe(false);
    expect(isOpen(closed, closed.closes_at)).toBe(false);
    expect(isOpen(closed, closed.closes_at - 1)).toBe(true);
  });
  it("DATA_CLOCK=scan keeps fixture markets open at the scan time; the real clock closes them", () => {
    const store = { meta: { scanned_at: closed.closes_at - 3600 } } as Parameters<typeof isOpenIn>[1];
    const prev = process.env.DATA_CLOCK;
    process.env.DATA_CLOCK = "scan";
    expect(isOpenIn(closed, store)).toBe(true);
    delete process.env.DATA_CLOCK;
    expect(isOpenIn(closed, store)).toBe(Date.now() / 1000 < closed.closes_at);
    if (prev !== undefined) process.env.DATA_CLOCK = prev;
  });
});

describe("e2e device header", () => {
  it("is honored only under E2E_MOCK outside production", () => {
    const req = new Request("http://x", { headers: { "x-e2e-device": "t1" } });
    const prev = { m: process.env.E2E_MOCK };
    delete process.env.E2E_MOCK;
    expect(deviceOf(req)).toBe("local");
    process.env.E2E_MOCK = "1";
    expect(deviceOf(req)).toBe("e2e:t1");
    if (prev.m === undefined) delete process.env.E2E_MOCK; else process.env.E2E_MOCK = prev.m;
  });
});

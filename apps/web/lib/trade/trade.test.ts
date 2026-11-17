import { afterEach, describe, expect, it, vi } from "vitest";
import { feeCents, fillableNow, NonceRequest, ticketMath } from "./intent";
import { canonical, consumeNonce, issueExtToken, issueNonce, NONCE_TTL_MS, tradingAllowed, tradingEnv, verifyExtToken } from "./server";

const order = { ticker: "KXTEST-26NOV17", side: "yes" as const, price_cents: 61, count: 10, client_order_id: "3f1c2a9e-1b2c-4d5e-8f90-123456789abc" };

afterEach(() => vi.unstubAllEnvs());

describe("trading flag", () => {
  it("is on only for KALSHI_TRADING_ENV=demo", () => {
    vi.stubEnv("KALSHI_TRADING_ENV", "");
    expect(tradingEnv()).toBeNull();
    vi.stubEnv("KALSHI_TRADING_ENV", "prod");
    expect(tradingEnv()).toBeNull(); // production stays off until docs/16 §5
    vi.stubEnv("KALSHI_TRADING_ENV", "demo");
    expect(tradingEnv()).toBe("demo");
  });
  it("allow-lists everyone in demo mode", () => expect(tradingAllowed(null)).toBe(true));
});

describe("nonce", () => {
  it("is one-time and bound to the exact order", () => {
    const n = issueNonce("place", order)!;
    expect(consumeNonce(n, "place", { ...order, count: 11 })).toBe(false);
    expect(consumeNonce(n, "cancel", order)).toBe(false);
    // key order doesn't matter, content does
    const reordered = Object.fromEntries(Object.entries(order).reverse());
    expect(consumeNonce(n, "place", reordered)).toBe(true);
    expect(consumeNonce(n, "place", order)).toBe(false); // used
  });
  it("expires", () => {
    const n = issueNonce("place", order, 0)!;
    expect(consumeNonce(n, "place", order, NONCE_TTL_MS + 1)).toBe(false);
  });
  it("rejects tampering", () => {
    const n = issueNonce("place", order)!;
    const [body, sig] = n.split(".");
    expect(consumeNonce(`${body}x.${sig}`, "place", order)).toBe(false);
    expect(consumeNonce("garbage", "place", order)).toBe(false);
  });
  it("canonical JSON sorts keys", () => expect(canonical({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}'));
  it("request schema strips nothing it shouldn't and rejects bad intents", () => {
    expect(NonceRequest.safeParse({ action: "place", payload: order }).success).toBe(true);
    expect(NonceRequest.safeParse({ action: "place", payload: { ...order, price_cents: 100 } }).success).toBe(false);
    expect(NonceRequest.safeParse({ action: "place", payload: { ...order, client_order_id: "x" } }).success).toBe(false);
    expect(NonceRequest.safeParse({ action: "transfer", payload: {} }).success).toBe(false);
  });
});

describe("extension token", () => {
  it("round-trips and expires", () => {
    const t = issueExtToken("u@x", "premium", 1_000)!;
    expect(verifyExtToken(t.token, 2_000)).toMatchObject({ sub: "u@x", tier: "premium" });
    expect(verifyExtToken(t.token, t.exp + 1)).toBeNull();
    expect(verifyExtToken(issueNonce("place", order))).toBeNull(); // a nonce is not a token
  });
});

describe("ticket math", () => {
  it("fee estimate matches the extension's", () => expect(feeCents(10, 61)).toBe(17));
  it("$ amount buys whole contracts with the fee inside the amount", () => {
    const t = ticketMath("usd", 10, 61, 0.7)!;
    expect(t.count).toBe(15);
    expect(t.maxCostCents).toBeLessThanOrEqual(1000);
    expect(t.payoutCents).toBe(1500);
    expect(t.roiPct).toBeCloseTo(((0.7 - t.maxCostCents / 100 / 15) / (t.maxCostCents / 100 / 15)) * 100);
  });
  it("contracts mode and bad input", () => {
    expect(ticketMath("contracts", 3, 50, null)).toMatchObject({ count: 3, costCents: 150, roiPct: null });
    expect(ticketMath("usd", 0.2, 50, 0.6)).toBeNull();
    expect(ticketMath("usd", 10, 0, 0.6)).toBeNull();
  });
  it("fillable now walks the book up to the limit", () => {
    expect(fillableNow([[60, 5], [61, 5], [63, 100]], 61, 20)).toEqual({ now: 10, rests: 10, avgCents: 60.5 });
    expect(fillableNow([], 61, 5)).toEqual({ now: 0, rests: 5, avgCents: null });
  });
});

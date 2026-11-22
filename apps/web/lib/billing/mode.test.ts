// F7: test vs live selection by env, and no Stripe secret or price id committed to the repo.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stripeMode } from "./mode";
import { billingMode, PRICE_KEYS, priceId } from "./stripe";

afterEach(() => vi.unstubAllEnvs());

describe("stripe mode comes from env", () => {
  it("reads live and test from the key prefix, restricted keys included", () => {
    expect(stripeMode({ STRIPE_SECRET_KEY: "sk_live_FAKEFAKEFAKE0000" })).toBe("live");
    expect(stripeMode({ STRIPE_SECRET_KEY: "sk_test_FAKEFAKEFAKE0000" })).toBe("test");
    expect(stripeMode({ STRIPE_SECRET_KEY: "rk_live_FAKEFAKEFAKE0000" })).toBe("live");
    expect(stripeMode({ STRIPE_SECRET_KEY: "rk_test_FAKEFAKEFAKE0000" })).toBe("test");
  });
  it("is null for empty, missing, publishable or garbage keys", () => {
    for (const v of [undefined, "", "pk_live_FAKEFAKEFAKE0000", "sk_prod_FAKEFAKEFAKE0000", "sk_live_x", "whsec_FAKEFAKEFAKE0000"])
      expect(stripeMode({ STRIPE_SECRET_KEY: v })).toBeNull();
  });
  it("defaults to process.env", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_FAKEFAKEFAKE0000");
    expect(stripeMode()).toBe("live");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_FAKEFAKEFAKE0000");
    expect(stripeMode()).toBe("test");
  });
  it("price ids are read from the 4 STRIPE_PRICE_* vars, nothing else", () => {
    for (const k of PRICE_KEYS) vi.stubEnv(`STRIPE_PRICE_${k.toUpperCase()}`, "");
    expect(PRICE_KEYS.map(priceId)).toEqual(["", "", "", ""]);
    PRICE_KEYS.forEach((k, i) => vi.stubEnv(`STRIPE_PRICE_${k.toUpperCase()}`, `price_env_${i}`));
    expect(PRICE_KEYS.map(priceId)).toEqual(["price_env_0", "price_env_1", "price_env_2", "price_env_3"]);
  });
  it("checkout needs the webhook secret, the key and all 4 price ids; links mode otherwise unused", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_FAKEFAKEFAKE0000");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_FAKEFAKEFAKE0000");
    for (const k of PRICE_KEYS) vi.stubEnv(`STRIPE_PRICE_${k.toUpperCase()}`, "price_x");
    expect(billingMode()).toBe("checkout");
    vi.stubEnv("STRIPE_PRICE_PRO_YEARLY", "");
    expect(billingMode()).toBeNull();
    vi.stubEnv("STRIPE_PRICE_PRO_YEARLY", "price_x");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(billingMode()).toBeNull();
  });
});

// Scans: apps/web and config/ source and docs text files, plus ops/ scripts. Skips node_modules, .next, .git,
// test fixtures (fixtures.*, fixtures/) and *.test.* files (they hold FAKE values on purpose).
describe("no Stripe key or price id in the repo", () => {
  const root = resolve(import.meta.dirname, "../../../..");
  const SKIP_DIR = new Set(["node_modules", ".next", ".git", "fixtures", "test-results", "playwright-report"]);
  const TEXT = /\.(ts|tsx|js|mjs|json|md|yml|yaml|env|example|sh|py|sql)$|\.env/;
  const BAD = /sk_live_\w{8,}|rk_live_\w{8,}|whsec_\w{10,}|\bprice_[A-Za-z0-9]{10,}/;
  function* walk(dir: string): Generator<string> {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIR.has(name)) continue;
      const p = join(dir, name);
      const s = statSync(p);
      if (s.isDirectory()) yield* walk(p);
      else if (TEXT.test(name) && !/\.test\.[mc]?[jt]sx?$|^fixtures\./.test(name) && s.size < 2_000_000) yield p;
    }
  }
  it("finds 0 hits", () => {
    const hits: string[] = [];
    for (const d of ["apps", "config", "ops", "docs", ".github"]) {
      try { statSync(join(root, d)); } catch { continue; }
      for (const f of walk(join(root, d))) {
        const m = BAD.exec(readFileSync(f, "utf8"));
        if (m) hits.push(`${relative(root, f)}: ${m[0].slice(0, 12)}...`);
      }
    }
    expect(hits).toEqual([]);
  });
});

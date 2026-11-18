// docs/15: the Free tier's 15-min delay holds on a cold serverless instance (nothing in memory): the store reads the
// `*-prev.json` copy the publisher keeps (ops/upload.py, refresh.yml), and never falls through to the live scan.
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({ getMe: async () => ({ user: null, tier: "free" }), getTier: async () => "free" }));

const FIX = path.resolve(__dirname, "fixtures");
const dir = mkdtempSync(path.join(tmpdir(), "me-delay-"));
const now = Math.floor(Date.now() / 1000);
const OLD = now - 3600, NEW = now - 60;   // newest scan is 1 minute old

const withScan = (file: string, at: number, out = file) => {
  const j = JSON.parse(readFileSync(path.join(FIX, file), "utf8"));
  j.meta.scanned_at = at;
  if (file === "flags.json") j.flags[0].best.roi_pct = at === NEW ? 77.7 : j.flags[0].best.roi_pct;   // marks the live copy
  writeFileSync(path.join(dir, out), JSON.stringify(j));
};
for (const f of ["model.json", "backtest.json"]) copyFileSync(path.join(FIX, f), path.join(dir, f));
withScan("markets.json", NEW);
withScan("flags.json", NEW);

const saved = process.env.DATA_DIR;
process.env.DATA_DIR = dir;
const { DelayedPending, getStoreFor } = await import("@/lib/data/store");
const { GET: flags } = await import("@/app/api/flags/route");
const { DELAYED_PENDING, delayedPendingLine } = await import("@/lib/api");
const { ErrorState } = await import("@/components/screener/States");
const { default: About } = await import("@/app/about/page");
const { default: MarketPage } = await import("@/app/m/[id]/page");
const { default: EventPage } = await import("@/app/event/[id]/page");
/** A cold instance: the module-level store state starts empty. */
const cold = () => {
  const s = (globalThis as { __meStore?: Record<string, unknown> }).__meStore ?? {};
  for (const k of Object.keys(s)) delete s[k];
};
afterAll(() => { process.env.DATA_DIR = saved; rmSync(dir, { recursive: true, force: true }); cold(); });
beforeEach(cold);

describe("Free delay on a cold instance", () => {
  it("serves the published previous scan, not the live one", async () => {
    withScan("markets.json", OLD, "markets-prev.json");
    withScan("flags.json", OLD, "flags-prev.json");
    expect((await getStoreFor("free")).meta.scanned_at).toBe(OLD);
    expect((await getStoreFor("pro")).meta.scanned_at).toBe(NEW);
    const body = await (await flags(new Request("http://t/api/flags"))).json();
    expect(JSON.stringify(body)).not.toContain("77.7");
  });

  it("fails closed (503) when there is no previous scan, instead of serving live data", async () => {
    rmSync(path.join(dir, "markets-prev.json"), { force: true });
    rmSync(path.join(dir, "flags-prev.json"), { force: true });
    await expect(getStoreFor("free")).rejects.toThrow(/prev/);
    expect((await flags(new Request("http://t/api/flags"))).status).toBe(503);
    expect((await getStoreFor("premium")).meta.scanned_at).toBe(NEW);
  });

  it("refuses a *-prev.json that is not older than the newest scan", async () => {
    withScan("markets.json", NEW, "markets-prev.json");
    withScan("flags.json", NEW, "flags-prev.json");
    await expect(getStoreFor("free")).rejects.toThrow(/not older/);
  });
});

// AUDIT run 2 fail 1: right after a fresh scan with no *-prev.json, Free gets an honest "first update shortly"
// state on every page and a 503 with a clear body from the API; paid tiers keep live data; nothing 500s.
describe("Free delay with no delayed copy yet", () => {
  const LINE = delayedPendingLine(15);
  const none = () => {
    rmSync(path.join(dir, "markets-prev.json"), { force: true });
    rmSync(path.join(dir, "flags-prev.json"), { force: true });
  };

  it("getStoreFor throws DelayedPending (missing and not-older); paid tiers get live", async () => {
    none();
    await expect(getStoreFor("free")).rejects.toBeInstanceOf(DelayedPending);
    withScan("markets.json", NEW, "markets-prev.json");
    withScan("flags.json", NEW, "flags-prev.json");
    await expect(getStoreFor("free")).rejects.toBeInstanceOf(DelayedPending);
    expect((await getStoreFor("pro")).meta.scanned_at).toBe(NEW);
  });

  it("API: 503 with the code, the honest line and Retry-After", async () => {
    none();
    const res = await flags(new Request("http://t/api/flags"));
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(await res.json()).toEqual({ error: LINE, code: DELAYED_PENDING });
  });

  it("/about, /m/[id], /event/[id] render the pending state, not a crash", async () => {
    none();
    const pages = [
      About(),
      MarketPage({ params: Promise.resolve({ id: "6674492" }), searchParams: Promise.resolve({}) }),
      EventPage({ params: Promise.resolve({ id: "1313371" }) }),
    ];
    for (const p of pages) {
      const out = renderToStaticMarkup((await p) as ReactElement);
      expect(out).toContain(LINE);
      expect(out).toContain("/pricing");
    }
  });

  it("screeners show the pending state for the pending error, the generic error otherwise", () => {
    const pending = renderToStaticMarkup(createElement(ErrorState, { onRetry: () => {}, error: `pending: ${LINE}` }));
    expect(pending).toContain(LINE);
    expect(pending).not.toContain("Couldn");
    expect(renderToStaticMarkup(createElement(ErrorState, { onRetry: () => {}, error: "/api/flags: HTTP 500" }))).toContain("Couldn");
  });
});

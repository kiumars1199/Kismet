// docs/15: the Free tier's 15-min delay holds on a cold serverless instance (nothing in memory): the store reads the
// `*-prev.json` copy the publisher keeps (ops/upload.py, refresh.yml), and never falls through to the live scan.
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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
const { getStoreFor } = await import("@/lib/data/store");
const { GET: flags } = await import("@/app/api/flags/route");
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

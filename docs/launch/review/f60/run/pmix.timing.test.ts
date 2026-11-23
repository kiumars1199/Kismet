// Reviewer timing check, #60: one 120 s refresh of getPolymarketIndex with the meta unchanged vs no meta (the #59 path).
import { copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
const FIX = "/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/apps/web/test/fixtures";
const N = 143_194;
const tags = [["sports", "nba"], ["politics", "us"], ["crypto", "btc"], ["sports", "nfl"]];
function write(dir: string, at: number, meta: boolean) {
  const rows = Array.from({ length: N }, (_, i) => { const t = tags[i % 4]!; return [String(9_000_000 + i), `Will market number ${i} resolve yes by the end of the season?`, `Event ${Math.floor(i / 7)}`, `event-${Math.floor(i / 7)}`, t[0], t[1], t, 1 + (i % 3), i % 5 ? null : 1794000000 + i]; });
  writeFileSync(path.join(dir, "polymarket_index.json"), JSON.stringify({ meta: { source: "Polymarket", fetched_at: at, n: N, columns: [] }, rows }));
  if (meta) writeFileSync(path.join(dir, "polymarket_index_meta.json"), JSON.stringify({ fetched_at: at, n: N }));
  else rmSync(path.join(dir, "polymarket_index_meta.json"), { force: true });
}
const ms = async (f: () => Promise<unknown>) => { const t = performance.now(); await f(); return +(performance.now() - t).toFixed(1); };
it("refresh timings", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pmix60-"));
  for (const f of readdirSync(FIX)) if (f.endsWith(".json") && !f.startsWith("polymarket_index")) copyFileSync(path.join(FIX, f), path.join(dir, f));
  vi.stubEnv("DATA_DIR", dir);
  vi.useFakeTimers({ toFake: ["Date"] });
  const out: Record<string, unknown> = {};
  for (const withMeta of [true, false]) {
    write(dir, 100, withMeta);
    out[`size_mb`] = +(statSync(path.join(dir, "polymarket_index.json")).size / 1e6).toFixed(1);
    vi.resetModules();
    const { getPolymarketIndex } = await import("@/lib/data/store");
    const label = withMeta ? "meta" : "nometa";
    out[`${label}_cold`] = await ms(getPolymarketIndex);
    const first = await getPolymarketIndex();
    const unchanged: number[] = [];
    for (let k = 0; k < 5; k++) { vi.setSystemTime(Date.now() + 121_000); unchanged.push(await ms(getPolymarketIndex)); }
    expect(await getPolymarketIndex()).toBe(first);
    out[`${label}_refresh_unchanged`] = unchanged;
    write(dir, 200, withMeta);
    vi.setSystemTime(Date.now() + 121_000);
    out[`${label}_refresh_new_build`] = await ms(getPolymarketIndex);
    expect((await getPolymarketIndex())!.fetchedAt).toBe(200);
  }
  writeFileSync("/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/docs/launch/review/f60/timings.json", JSON.stringify(out, null, 1));
});

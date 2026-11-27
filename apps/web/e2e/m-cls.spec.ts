// /m/<id>: no layout jump on load. <MarketDetail> streams in inside a Suspense; without a sized fallback the footer painted
// high and was pushed down in one ~0.43 shift on a share of cold loads. Each market loads cold 6 times at each size (a fresh
// context every time, no warm-up) and every load must stay under the 0.1 CLS budget.
import { expect, test } from "@playwright/test";

for (const id of ["6674492", "7078474"]) {
  for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
    test(`/m/${id} cold-load CLS is under 0.1 at ${w}px, every time`, async ({ browser }) => {
      test.setTimeout(240_000);
      const runs: number[] = [];
      for (let i = 0; i < 6; i++) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, baseURL: test.info().project.use.baseURL });
        const page = await ctx.newPage();
        // The e2e server runs with KALSHI_TRADING_ENV=demo, so the paper "Trade" button appears after /api/trade/config answers. The
        // /m page now decides that on the server (F14, lib/trade/reserve.ts) and keeps its slot from the first paint, so the real
        // answer is used here (mocking it "off" would remove a slot the server reserved and move the page).
        await page.addInitScript(() => {
          const win = window as unknown as { __cls: number };
          win.__cls = 0;
          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) win.__cls += e.value;
          }).observe({ type: "layout-shift", buffered: true });
        });
        await page.goto(`/m/${id}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1_200);
        runs.push(await page.evaluate(() => (window as unknown as { __cls: number }).__cls));
        await ctx.close();
      }
      console.log(`CLS /m/${id} at ${w}px over ${runs.length} cold loads: ${runs.map((x) => x.toFixed(3)).join(", ")}`);
      for (const c of runs) expect(c).toBeLessThan(0.1);
    });
  }
}

// /event/<id>: no layout jump on load. The page streams <EventView> inside a Suspense; without a sized fallback the footer
// painted high and was pushed down in one ~0.43 shift on about half the cold loads. Each size loads cold several times
// (a fresh context each time, so nothing is cached) and every load must stay under the 0.1 CLS budget.
import { expect, test } from "@playwright/test";

for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  test(`/event/<id> cold-load CLS is under 0.1 at ${w}px, every time`, async ({ browser, request }) => {
    test.setTimeout(240_000);
    const flags = await (await request.get("/api/flags")).json();
    const eventId = flags.rows.find((r: { market: { event_id?: string } }) => r.market.event_id)?.market.event_id as string;
    expect(eventId).toBeTruthy();
    const runs: number[] = [];
    for (let i = 0; i < 6; i++) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, baseURL: test.info().project.use.baseURL });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        const win = window as unknown as { __cls: number };
        win.__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) win.__cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(`/event/${encodeURIComponent(eventId)}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1_200);
      runs.push(await page.evaluate(() => (window as unknown as { __cls: number }).__cls));
      await ctx.close();
    }
    console.log(`CLS /event/<id> at ${w}px over ${runs.length} cold loads: ${runs.map((x) => x.toFixed(3)).join(", ")}`);
    for (const c of runs) expect(c).toBeLessThan(0.1);
  });
}
